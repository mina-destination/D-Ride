import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { StopSchema, StopEntity } from './stop.schema';

export type RouteDocument = Route & Document;

@Schema({ timestamps: true })
export class Route {
  @Prop({ required: true })
  name: string;

  @Prop({
    type: {
      type: String,
      enum: ['LineString'],
      required: true,
      default: 'LineString',
    },
    coordinates: {
      type: [[Number]], // Array of arrays of numbers: [longitude, latitude]
      required: true,
    },
  })
  path: {
    type: string;
    coordinates: number[][];
  };

  @Prop()
  coverImage?: string;

  @Prop({ type: [StopSchema], default: [] })
  checkpoints: StopEntity[];
}

export const RouteSchema = SchemaFactory.createForClass(Route);
RouteSchema.index({ path: '2dsphere' });
