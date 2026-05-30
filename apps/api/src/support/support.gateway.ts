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
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface SendMessagePayload {
  ticketId: string;
  senderId: string;
  senderRole: string;
  senderName: string;
  message: string;
}

@WebSocketGateway({
  namespace: 'support',
  cors: {
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : [
          'http://localhost:5173',
          'http://localhost:5174',
          'http://localhost:5175',
          'http://localhost:3001',
        ],
    credentials: true,
  },
  pingTimeout: 30000,
  pingInterval: 5000,
})
export class SupportGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SupportGateway.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    server.use((socket: any, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization;
        if (!token) {
          return next(new Error('Unauthorized: Token missing'));
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
        next(new Error('Unauthorized: Invalid or expired token'));
      }
    });
  }

  handleConnection(client: any) {
    const user = client.user;
    const role = (user?.role || '').toUpperCase();

    if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OPERATION') {
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

    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'OPERATION'].includes(user.role);
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
      // Save message to Postgres database
      const savedMsg = await this.prisma.chatMessage.create({
        data: {
          ticketId: data.ticketId,
          senderId: senderId,
          senderRole: senderRole,
          senderName: senderName,
          message: data.message,
        },
      });

      // Broadcast to room
      this.server.to(`ticket_${data.ticketId}`).emit('newMessage', savedMsg);

      // Broadcast live ticketActivity notification exclusively to the support_operators room
      this.server.to('support_operators').emit('ticketActivity', {
        ticketId: data.ticketId,
        lastMessage: data.message,
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
