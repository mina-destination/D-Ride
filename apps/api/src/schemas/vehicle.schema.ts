import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VehicleDocument = VehicleEntity & Document;

@Schema({ timestamps: true, collection: 'vehicles' })
export class VehicleEntity {
  @Prop({ required: true })
  make: string;

  @Prop({ required: true })
  model: string;

  @Prop({ required: true, unique: true })
  licensePlate: string;

  @Prop({ required: true, default: 14 })
  capacity: number;

  @Prop({
    required: true,
    enum: ['ACTIVE', 'MAINTENANCE', 'OUT_OF_SERVICE'],
    default: 'ACTIVE',
  })
  status: string;
}

export const VehicleSchema = SchemaFactory.createForClass(VehicleEntity);
