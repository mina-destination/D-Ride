import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
    origin: '*',
  },
  pingTimeout: 30000,
  pingInterval: 5000,
})
export class SupportGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SupportGateway.name);

  constructor(private prisma: PrismaService) {}

  handleConnection(client: Socket) {
    const role = client.handshake.query?.role;
    if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OPERATION') {
      client.join('support_operators');
      this.logger.log(
        `Support client ${client.id} with role ${role} joined support_operators room`,
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
