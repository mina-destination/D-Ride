import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TransactionDocument = Transaction & Document;

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ required: true, unique: true })
  paymobOrderId: number;

  @Prop({ required: true })
  amountCents: number;

  @Prop({ required: true })
  status: string;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
