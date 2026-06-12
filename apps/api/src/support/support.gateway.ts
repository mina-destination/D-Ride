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
      if (!origins.includes('https://localhost')) origins.push('https://localhost');
      if (!origins.includes('capacitor://localhost')) origins.push('capacitor://localhost');
      return origins;
    })(),
    credentials: true,
  },
  pingTimeout: 30000,
  pingInterval: 5000,
})
export class SupportGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SupportGateway.name);
  private rateLimitCleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(forwardRef(() => WhatsappService))
    private whatsappService: WhatsappService,
  ) {}

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

    // Rate limiting: max 30 messages per minute per connection
    const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
    const RATE_LIMIT = 30;
    const RATE_WINDOW_MS = 60 * 1000;

    server.use((socket: any, next) => {
      const now = Date.now();
      const userId = socket.user?.id || socket.id;
      const record = rateLimitMap.get(userId);

      if (!record || now > record.resetTime) {
        rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_WINDOW_MS });
      } else {
        record.count++;
        if (record.count > RATE_LIMIT) {
          this.logger.warn(`Rate limit exceeded for user ${userId}`);
          socket.disconnect(true);
          return;
        }
      }
      next();
    });

    // Cleanup old entries periodically
    this.rateLimitCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of rateLimitMap.entries()) {
        if (now > record.resetTime) {
          rateLimitMap.delete(key);
        }
      }
    }, RATE_WINDOW_MS);
  }

  onModuleDestroy() {
    if (this.rateLimitCleanupInterval) {
      clearInterval(this.rateLimitCleanupInterval);
      this.rateLimitCleanupInterval = null;
    }
  }

  handleConnection(client: any) {
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
    }
    this.logger.log(`Support client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
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
      // Verify that the ticket is owned by the authenticated user
      const ticket = await this.prisma.supportTicket.findUnique({
        where: { id: ticketId },
      });
      if (!ticket || ticket.userId !== user.id) {
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
        if (ticket && ticket.subject === 'WhatsApp Support Session' && ticket.phone) {
          await this.whatsappService.sendWhatsAppMessage(ticket.phone, data.message);
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
