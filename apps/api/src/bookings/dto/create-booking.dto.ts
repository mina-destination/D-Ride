import {
  IsNotEmpty,
  IsArray,
  IsNumber,
  IsOptional,
  IsUUID,
  IsString,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

class LocationDto {
  @IsString()
  type: string;

  @IsArray()
  @IsNumber({}, { each: true })
  coordinates: number[];
}

class CheckpointDto {
  @IsOptional()
  @IsString()
  _id?: string;

  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsString()
  type: string;

  @IsNumber()
  order: number;

  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsObject()
  prices?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  minutesFromStart?: number;

  @IsOptional()
  @IsNumber()
  bufferTimeMinutes?: number;

  @IsOptional()
  @IsNumber()
  priceFromStartEGP?: number;

  @IsOptional()
  @IsNumber()
  geofenceRadiusMeters?: number;

  @IsOptional()
  @IsString()
  estimatedDepartureTime?: string;

  @IsOptional()
  @IsString()
  estimatedArrivalTime?: string;

  @IsOptional()
  @IsString()
  localizedDepartureTime?: string;

  @IsOptional()
  @IsString()
  localizedArrivalTime?: string;
}

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
  @ValidateNested()
  @Type(() => CheckpointDto)
  pickupCheckpoint?: CheckpointDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CheckpointDto)
  dropoffCheckpoint?: CheckpointDto;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  isReward?: boolean;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}
