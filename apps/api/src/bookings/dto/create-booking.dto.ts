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
}
