import {
  IsNotEmpty,
  IsArray,
  IsNumber,
  IsOptional,
  IsUUID,
  IsObject,
  IsString,
} from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  @IsNotEmpty()
  tripId: string;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsNotEmpty()
  seatNumbers: number[];

  @IsOptional()
  @IsString()
  pickupStopId?: string;

  @IsOptional()
  @IsString()
  dropoffStopId?: string;

  @IsOptional()
  @IsString()
  pickupCheckpointId?: string;

  @IsOptional()
  @IsString()
  dropoffCheckpointId?: string;

  @IsOptional()
  @IsObject()
  pickupCheckpoint?: Record<string, any>;

  @IsOptional()
  @IsObject()
  dropoffCheckpoint?: Record<string, any>;
}
