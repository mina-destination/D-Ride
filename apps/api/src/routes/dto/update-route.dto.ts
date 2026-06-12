import {
  IsString,
  IsArray,
  IsOptional,
  ValidateNested,
  IsObject,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

class LocationDto {
  @IsString()
  @IsOptional()
  type?: string;

  @IsArray()
  @IsOptional()
  coordinates?: number[];
}

class StopDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  nameAr?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => LocationDto)
  @IsOptional()
  location?: LocationDto;

  @IsString()
  @IsOptional()
  address?: string;

  @IsOptional()
  order?: number;

  @IsString()
  @IsOptional()
  type?: string;

  @IsOptional()
  bufferTimeMinutes?: number;

  @IsOptional()
  geofenceRadiusMeters?: number;

  @IsOptional()
  minutesFromStart?: number;

  @IsString()
  @IsOptional()
  city?: string;

  @IsOptional()
  priceFromStartEGP?: number;

  @IsObject()
  @IsOptional()
  prices?: Record<string, number>;

  @IsObject()
  @IsOptional()
  premiumSurcharges?: Record<string, number>;

  @IsString()
  @IsOptional()
  purpose?: string;
}

class PathDto {
  @IsString()
  @IsOptional()
  type?: string;

  @IsArray()
  @IsArray({ each: true })
  @IsOptional()
  coordinates?: number[][];
}

export class UpdateRouteDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PathDto)
  @IsOptional()
  path?: PathDto;

  @IsString()
  @IsOptional()
  coverImage?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StopDto)
  @IsOptional()
  checkpoints?: StopDto[];

  @IsOptional()
  distanceKm?: number;

  @IsOptional()
  estimatedDurationMinutes?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isDeleted?: boolean;

  @IsOptional()
  priceEGP?: number;

  @IsOptional()
  premiumSeatSurcharge?: number;
}
