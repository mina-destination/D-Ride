import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  async submitTicket(
    userId: string,
    data: { subject: string; message: string },
  ): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Limit open support tickets to prevent spam / DoS
    const openTicketsCount = await this.prisma.supportTicket.count({
      where: {
        userId,
        status: 'OPEN',
      },
    });

    if (openTicketsCount >= 5) {
      throw new BadRequestException(
        'You have too many open support tickets. Please wait for your existing tickets to be resolved before submitting a new one.',
      );
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        subject: data.subject,
        message: data.message,
        status: 'OPEN',
        replies: [],
      },
    });

    return { ...ticket, _id: ticket.id, user: ticket.userId };
  }

  async getAllTickets(): Promise<any[]> {
    const tickets = await this.prisma.supportTicket.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    return tickets.map((t) => ({ ...t, _id: t.id, user: t.userId }));
  }

  async resolveTicket(ticketId: string): Promise<any> {
    try {
      const ticket = await this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: 'RESOLVED' },
      });
      return { ...ticket, _id: ticket.id, user: ticket.userId };
    } catch (err) {
      throw new NotFoundException('Ticket not found');
    }
  }

  async replyToTicket(
    ticketId: string,
    replyText: string,
    adminName: string,
  ): Promise<any> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const replies = Array.isArray(ticket.replies)
      ? [...(ticket.replies as any[])]
      : [];
    replies.push({
      text: replyText,
      createdAt: new Date().toISOString(),
      adminName: adminName,
    });

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        replies: replies,
        status: 'OPEN',
      },
    });

    return { ...updated, _id: updated.id, user: updated.userId };
  }

  async getTicketMessages(ticketId: string): Promise<any[]> {
    return this.prisma.chatMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getUserTickets(userId: string): Promise<any[]> {
    const tickets = await this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return tickets.map((t) => ({ ...t, _id: t.id, user: t.userId }));
  }
}
