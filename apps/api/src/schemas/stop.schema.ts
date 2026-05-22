import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StopDocument = StopEntity & Document;

@Schema({ timestamps: true, collection: 'stops' })
export class StopEntity {
  @Prop({ required: true })
  name: string;

  @Prop()
  nameAr: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  })
  location: {
    type: string;
    coordinates: number[];
  };

  @Prop()
  address: string;

  @Prop({ required: true })
  order: number;
}

export const StopSchema = SchemaFactory.createForClass(StopEntity);
StopSchema.index({ location: '2dsphere' });
