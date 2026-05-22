import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LiveVehicleLocationDocument = LiveVehicleLocation & Document;

@Schema({ timestamps: true })
export class LiveVehicleLocation {
  @Prop({ required: true })
  vehicleId: string;

  @Prop({ required: true })
  driverId: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  })
  location: {
    type: string;
    coordinates: number[];
  };

  @Prop({ default: Date.now, expires: 60 }) // 60-second TTL index
  createdAt: Date;
}

export const LiveVehicleLocationSchema =
  SchemaFactory.createForClass(LiveVehicleLocation);
LiveVehicleLocationSchema.index({ location: '2dsphere' });
