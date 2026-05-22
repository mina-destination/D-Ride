import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SupportTicketDocument = SupportTicketEntity & Document;

@Schema({ timestamps: true, collection: 'support_tickets' })
export class SupportTicketEntity {
  @Prop({ type: Types.ObjectId, ref: 'UserEntity', required: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true, enum: ['OPEN', 'RESOLVED'], default: 'OPEN' })
  status: string;

  @Prop({
    type: [
      {
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        adminName: { type: String, required: true },
      },
    ],
    default: [],
  })
  replies: { text: string; createdAt: Date; adminName: string }[];
}

export const SupportTicketSchema =
  SchemaFactory.createForClass(SupportTicketEntity);
export { SupportTicketEntity as SupportTicket };
