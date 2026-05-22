import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SupportTicket,
  SupportTicketDocument,
} from '../schemas/support-ticket.schema';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class SupportService {
  constructor(
    @InjectModel(SupportTicket.name)
    private supportTicketModel: Model<SupportTicketDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async submitTicket(
    userId: string,
    data: { subject: string; message: string },
  ): Promise<SupportTicket> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const ticket = new this.supportTicketModel({
      user: new Types.ObjectId(userId),
      name: user.name,
      email: user.email,
      phone: user.phone,
      subject: data.subject,
      message: data.message,
      status: 'OPEN',
      replies: [],
    });

    return ticket.save();
  }

  async getAllTickets(): Promise<SupportTicket[]> {
    return this.supportTicketModel
      .find()
      .sort({ status: 1, createdAt: -1 })
      .exec();
  }

  async resolveTicket(ticketId: string): Promise<SupportTicket> {
    const ticket = await this.supportTicketModel.findById(ticketId).exec();
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    ticket.status = 'RESOLVED';
    return ticket.save();
  }

  async replyToTicket(
    ticketId: string,
    replyText: string,
    adminName: string,
  ): Promise<SupportTicket> {
    const ticket = await this.supportTicketModel.findById(ticketId).exec();
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    ticket.replies.push({
      text: replyText,
      createdAt: new Date(),
      adminName: adminName,
    });

    // Make sure status is open when a reply is added
    ticket.status = 'OPEN';

    return ticket.save();
  }
}
