import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TripDocument = TripEntity & Document;

@Schema({ timestamps: true, collection: 'trips' })
export class TripEntity {
  @Prop({ type: Types.ObjectId, ref: 'Route', required: true })
  routeId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'VehicleEntity' })
  vehicleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'UserEntity' })
  driverId: Types.ObjectId;

  @Prop({ required: true })
  departureTime: Date;

  @Prop()
  arrivalTime: Date;

  @Prop({
    required: true,
    enum: ['SCHEDULED', 'BOARDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'],
    default: 'SCHEDULED',
  })
  status: string;

  @Prop({ required: true })
  priceEGP: number;

  @Prop({ required: true })
  availableSeats: number;

  @Prop({ default: 0 })
  bookedSeats: number;

  @Prop({ type: [Number], default: [14] })
  lockedSeats: number[];
}

export const TripSchema = SchemaFactory.createForClass(TripEntity);
TripSchema.index({ routeId: 1, departureTime: 1 });
TripSchema.index({ driverId: 1, status: 1 });
TripSchema.index({ status: 1, departureTime: 1 });
