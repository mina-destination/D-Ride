import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RolePermissionDocument = RolePermission & Document;

@Schema({ collection: 'role_permissions' })
export class RolePermission {
  @Prop({ required: true, unique: true })
  role: string;

  @Prop({ type: [String], default: [] })
  permissions: string[];
}

export const RolePermissionSchema =
  SchemaFactory.createForClass(RolePermission);
