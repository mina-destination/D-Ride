import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsArray,
  IsNumber,
  IsOptional,
  IsMongoId,
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
  @IsMongoId()
  @IsNotEmpty()
  tripId: string;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsNotEmpty()
  seatNumbers: number[];

  @IsOptional()
  @IsMongoId()
  pickupStopId?: string;

  @IsOptional()
  @IsMongoId()
  dropoffStopId?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => StopDto)
  pickupCheckpoint?: StopDto;
}
