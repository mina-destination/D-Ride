import {
  IsNotEmpty,
  IsArray,
  IsNumber,
  IsOptional,
  IsUUID,
  IsString,
  ValidateNested,
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
}
