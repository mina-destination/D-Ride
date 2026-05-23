import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { StopSchema, StopEntity } from './stop.schema';

export type BookingDocument = BookingEntity & Document;

@Schema({ timestamps: true, collection: 'bookings' })
export class BookingEntity {
  @Prop({ type: Types.ObjectId, ref: 'UserEntity', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'TripEntity', required: true })
  tripId: Types.ObjectId;

  @Prop({ type: [Number], required: true })
  seatNumbers: number[];

  @Prop({ type: Types.ObjectId, ref: 'StopEntity', required: false })
  pickupStopId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'StopEntity', required: false })
  dropoffStopId?: Types.ObjectId;

  @Prop({ type: StopSchema, required: false })
  pickupCheckpoint?: StopEntity;

  @Prop({
    required: true,
    enum: [
      'PENDING',
      'PENDING_PAYMENT',
      'CONFIRMED',
      'BOARDED',
      'CANCELLED',
      'COMPLETED',
      'REFUNDED',
    ],
    default: 'PENDING',
  })
  status: string;

  @Prop({
    required: true,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
    default: 'PENDING',
  })
  paymentStatus: string;

  @Prop()
  paymobOrderId: number;

  @Prop({ required: true })
  amountEGP: number;

  @Prop({ default: Date.now })
  bookedAt: Date;

  @Prop({ required: false })
  qrVerificationToken?: string;
}

export const BookingSchema = SchemaFactory.createForClass(BookingEntity);
BookingSchema.index({ userId: 1, tripId: 1 });
BookingSchema.index({ paymobOrderId: 1 }, { unique: true, sparse: true });
BookingSchema.index({ userId: 1, status: 1 });
BookingSchema.index({ tripId: 1, status: 1 });
