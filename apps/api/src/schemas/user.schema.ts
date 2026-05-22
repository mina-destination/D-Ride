import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = UserEntity & Document;

@Schema({ timestamps: true, collection: 'users' })
export class UserEntity {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    required: true,
    enum: ['PASSENGER', 'DRIVER', 'OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION'],
    default: 'PASSENGER',
  })
  role: string;

  @Prop()
  avatarUrl: string;

  @Prop({ default: true })
  isActive: boolean;

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
  crmNotes?: { text: string; createdAt: Date; adminName: string }[];
}

export const UserSchema = SchemaFactory.createForClass(UserEntity);

export { UserEntity as User };
