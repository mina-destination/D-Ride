import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsArray,
  IsNumber,
  IsOptional,
  IsUUID,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

class LocationDto {
  @IsString()
  @IsOptional()
  type?: string;

  @IsArray()
  @IsNumber({}, { each: true })
  coordinates: number[];

  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  _id?: string;

  @IsString()
  @IsOptional()
  key?: string;
}

class StopDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  nameAr?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  order: number;

  @IsString()
  @IsOptional()
  type?: string;

  @IsNumber()
  @IsOptional()
  bufferTimeMinutes?: number;

  @IsNumber()
  @IsOptional()
  geofenceRadiusMeters?: number;

  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  _id?: string;

  @IsString()
  @IsOptional()
  key?: string;
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
  @IsUUID()
  pickupStopId?: string;

  @IsOptional()
  @IsUUID()
  dropoffStopId?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => StopDto)
  pickupCheckpoint?: StopDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => StopDto)
  dropoffCheckpoint?: StopDto;
}
