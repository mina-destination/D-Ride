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
        const secret =
          this.configService.get<string>('jwt.secret') ||
          'dev_jwt_secret_do_not_use_in_production';
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
    const handshakeRole = client.handshake.query?.role;
    const role = (handshakeRole || user?.role || '').toUpperCase();

    if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OPERATION') {
      client.join('support_operators');
      this.logger.log(
        `Support client ${client.id} (User: ${user?.id || 'unknown'}, Handshake Role: ${handshakeRole || 'none'}, Token Role: ${user?.role || 'none'}) joined support_operators room`,
      );
    }
    this.logger.log(`Support client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Support client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinTicket')
  handleJoinTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() ticketId: string,
  ) {
    this.logger.log(
      `Support Client ${client.id} joined ticket room: ${ticketId}`,
    );
    client.join(`ticket_${ticketId}`);
    return { event: 'joined', data: ticketId };
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessagePayload,
  ) {
    this.logger.log(
      `Support Message received for ticket ${data.ticketId} from ${data.senderName} (${data.senderRole}): ${data.message}`,
    );

    try {
      // Save message to Postgres database
      const savedMsg = await this.prisma.chatMessage.create({
        data: {
          ticketId: data.ticketId,
          senderId: data.senderId,
          senderRole: data.senderRole,
          senderName: data.senderName,
          message: data.message,
        },
      });

      // Broadcast to room
      this.server.to(`ticket_${data.ticketId}`).emit('newMessage', savedMsg);

      // Broadcast live ticketActivity notification exclusively to the support_operators room
      this.server.to('support_operators').emit('ticketActivity', {
        ticketId: data.ticketId,
        lastMessage: data.message,
        senderName: data.senderName,
        senderRole: data.senderRole,
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
