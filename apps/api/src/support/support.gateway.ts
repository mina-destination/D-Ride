import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef, OnModuleDestroy } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { createClient, RedisClientType } from 'redis';

export interface SendMessagePayload {
  ticketId: string;
  senderId: string;
  senderRole: string;
  senderName: string;
  message: string;
}

@WebSocketGateway({
  namespace: 'support',
  path: '/api/socket.io',
  cors: {
    origin: (() => {
      const origins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
        : [
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:5175',
            'http://localhost:3001',
          ];
      if (!origins.includes('https://localhost'))
        origins.push('https://localhost');
      if (!origins.includes('capacitor://localhost'))
        origins.push('capacitor://localhost');

      // Always allow D-Ride production/staging domains
      const prodOrigins = [
        'https://d-ride.net',
        'https://admin.d-ride.net',
        'https://api.d-ride.net',
        'https://passenger.d-ride.net',
        'https://driver.d-ride.net',
      ];
      prodOrigins.forEach((o) => {
        if (!origins.includes(o)) {
          origins.push(o);
        }
      });
      return origins;
    })(),
    credentials: true,
  },
  pingTimeout: 30000,
  pingInterval: 5000,
})
export class SupportGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SupportGateway.name);
  private redisClient: RedisClientType;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(forwardRef(() => WhatsappService))
    private whatsappService: WhatsappService,
  ) {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.redisClient = createClient({
      url: redisUrl,
      disableOfflineQueue: true,
    }) as any;
    this.redisClient.connect().catch((err) => {
      this.logger.error(
        `SupportGateway failed to connect to Redis: ${err.message}`,
      );
    });
  }

  afterInit(server: Server) {
    server.use((socket: any, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization;
        if (!token) {
          this.logger.warn(`WS auth failed: Token missing from ${socket.id}`);
          socket.disconnect(true);
          return;
        }
        const cleanToken = token.startsWith('Bearer ')
          ? token.split(' ')[1]
          : token;
        const secret = this.configService.getOrThrow<string>('jwt.secret');
        const payload = this.jwtService.verify(cleanToken, { secret });

        socket.user = {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        };
        next();
      } catch (err) {
        this.logger.warn(`WS auth failed: ${err.message} from ${socket.id}`);
        socket.disconnect(true);
      }
    });

    const RATE_LIMIT = 30;
    const RATE_WINDOW_SECONDS = 60;

    server.use((socket: any, next) => {
      (async () => {
        const userId = socket.user?.id || socket.id;
        const key = `ws:support:rate:${userId}`;

        if (this.redisClient && this.redisClient.isReady) {
          try {
            const current = await this.redisClient.incr(key);
            if (current === 1) {
              await this.redisClient.expire(key, RATE_WINDOW_SECONDS);
            }
            if (current > RATE_LIMIT) {
              this.logger.warn(`Redis Rate limit exceeded for user ${userId}`);
              socket.disconnect(true);
              return;
            }
            next();
            return;
          } catch (err: any) {
            this.logger.error(`Redis rate limiter error: ${err.message}`);
          }
        }

        // Fallback inline in-memory rate limiter directly on socket instance (no memory leak)
        if (!socket.rateLimitRecord) {
          socket.rateLimitRecord = {
            count: 1,
            resetTime: Date.now() + RATE_WINDOW_SECONDS * 1000,
          };
        } else {
          const now = Date.now();
          if (now > socket.rateLimitRecord.resetTime) {
            socket.rateLimitRecord.count = 1;
            socket.rateLimitRecord.resetTime = now + RATE_WINDOW_SECONDS * 1000;
          } else {
            socket.rateLimitRecord.count++;
            if (socket.rateLimitRecord.count > RATE_LIMIT) {
              this.logger.warn(
                `In-memory Rate limit exceeded for user ${userId}`,
              );
              socket.disconnect(true);
              return;
            }
          }
        }
        next();
      })().catch((err: any) => {
        this.logger.error(`Unexpected rate limiter error: ${err.message}`);
        next();
      });
    });
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.disconnect().catch(() => {});
    }
  }

  async handleConnection(client: any) {
    const user = client.user;
    const role = (user?.role || '').toUpperCase();

    if (
      role === 'ADMIN' ||
      role === 'SUPER_ADMIN' ||
      role === 'OPERATION' ||
      role === 'OWNER'
    ) {
      client.join('support_operators');
      this.logger.log(
        `Support client ${client.id} (User: ${user?.id || 'unknown'}, Role: ${user?.role || 'none'}) joined support_operators room`,
      );
    } else if (user) {
      // Cache all support tickets they own on connection to protect Postgres pool
      try {
        const tickets = await this.prisma.supportTicket.findMany({
          where: { userId: user.id },
          select: { id: true },
        });
        const ticketIds = tickets.map((t) => t.id);

        if (ticketIds.length > 0) {
          client.ownedTicketIds = new Set(ticketIds);

          if (this.redisClient && this.redisClient.isReady) {
            const cacheKey = `ws:support:user_tickets:${user.id}`;
            await this.redisClient.sAdd(cacheKey, ticketIds);
            await this.redisClient.expire(cacheKey, 3600);
          }
        }
      } catch (err: any) {
        this.logger.error(
          `Failed to cache ticket ownership for user ${user.id}: ${err.message}`,
        );
      }
    }
    this.logger.log(`Support client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const user = (client as any).user;
    if (user && this.redisClient && this.redisClient.isReady) {
      const cacheKey = `ws:support:user_tickets:${user.id}`;
      await this.redisClient.del(cacheKey).catch(() => {});
    }
    this.logger.log(`Support client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinTicket')
  async handleJoinTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() ticketId: string,
  ) {
    const user = (client as any).user;
    if (!user) {
      this.logger.error(
        'WebSocket joinTicket attempt from unauthenticated client',
      );
      client.disconnect(true);
      return { event: 'error', message: 'Unauthorized' };
    }

    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'OPERATION', 'OWNER'].includes(
      user.role,
    );
    if (!isAdmin) {
      let isOwned = false;
      const clientWithTickets = client as any;
      if (
        clientWithTickets.ownedTicketIds &&
        clientWithTickets.ownedTicketIds.has(ticketId)
      ) {
        isOwned = true;
      } else if (this.redisClient && this.redisClient.isReady) {
        try {
          const cacheKey = `ws:support:user_tickets:${user.id}`;
          isOwned = await this.redisClient.sIsMember(cacheKey, ticketId);
        } catch (err: any) {
          this.logger.error(`Redis sIsMember check failed: ${err.message}`);
        }
      }

      if (!isOwned) {
        // Fallback: query database to self-heal cache
        const ticket = await this.prisma.supportTicket.findUnique({
          where: { id: ticketId },
        });
        if (ticket && ticket.userId === user.id) {
          isOwned = true;
          if (clientWithTickets.ownedTicketIds) {
            clientWithTickets.ownedTicketIds.add(ticketId);
          } else {
            clientWithTickets.ownedTicketIds = new Set([ticketId]);
          }
          if (this.redisClient && this.redisClient.isReady) {
            const cacheKey = `ws:support:user_tickets:${user.id}`;
            await this.redisClient.sAdd(cacheKey, ticketId).catch(() => {});
          }
        }
      }

      if (!isOwned) {
        this.logger.warn(
          `Access Denied: User ${user.id} with role ${user.role} attempted to join support ticket room ${ticketId} without ownership`,
        );
        return { event: 'error', message: 'Access Denied' };
      }
    }

    this.logger.log(
      `Support Client ${client.id} (User: ${user.id}) joined ticket room: ${ticketId}`,
    );
    client.join(`ticket_${ticketId}`);
    return { event: 'joined', data: ticketId };
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessagePayload,
  ) {
    // Use authenticated user data instead of trusting client-supplied identity
    const authenticatedUser = (client as any).user;
    const senderId = authenticatedUser?.id || data.senderId;
    const senderRole = authenticatedUser?.role || data.senderRole;
    const senderName = data.senderName; // Name can come from client (display name)

    this.logger.log(
      `Support Message received for ticket ${data.ticketId} from ${senderName} (${senderRole}): ${data.message}`,
    );

    try {
      const sanitizedMessage = sanitizeHtml(data.message, {
        allowedTags: [],
        allowedAttributes: {},
      });

      // Save message to Postgres database
      const savedMsg = await this.prisma.chatMessage.create({
        data: {
          ticketId: data.ticketId,
          senderId: senderId,
          senderRole: senderRole,
          senderName: senderName,
          message: sanitizedMessage,
        },
      });

      // Broadcast to room
      this.server.to(`ticket_${data.ticketId}`).emit('newMessage', savedMsg);

      // If the message is sent by an operator, and it's a WhatsApp session, forward it to the passenger's WhatsApp
      if (senderRole !== 'PASSENGER') {
        const ticket = await this.prisma.supportTicket.findUnique({
          where: { id: data.ticketId },
        });
        if (
          ticket &&
          ticket.subject === 'WhatsApp Support Session' &&
          ticket.phone
        ) {
          await this.whatsappService.sendWhatsAppMessage(
            ticket.phone,
            data.message,
          );
        }
      }

      // Broadcast live ticketActivity notification exclusively to the support_operators room
      this.server.to('support_operators').emit('ticketActivity', {
        ticketId: data.ticketId,
        lastMessage: sanitizedMessage,
        senderName: senderName,
        senderRole: senderRole,
        createdAt: savedMsg.createdAt,
      });

      return { event: 'sent', data: savedMsg };
    } catch (error) {
      this.logger.error(
        `Failed to save chat message: ${error.message || error}`,
        error.stack,
      );
      return { event: 'error', status: 'FAILED' };
    }
  }
}
