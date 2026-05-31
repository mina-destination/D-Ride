import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  ValidateNested,
  IsObject,
  IsNumber,
  IsBoolean,
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

  @IsString()
  @IsOptional()
  type?: string;

  @IsNumber()
  @IsOptional()
  bufferTimeMinutes?: number;

  @IsNumber()
  @IsOptional()
  geofenceRadiusMeters?: number;

  @IsNumber()
  @IsOptional()
  minutesFromStart?: number;

  @IsString()
  @IsOptional()
  city?: string;

  @IsNumber()
  @IsOptional()
  priceFromStartEGP?: number;

  @IsObject()
  @IsOptional()
  prices?: Record<string, number>;
}

class PathDto {
  @IsString()
  @IsOptional()
  type?: string;

  @IsArray()
  @IsArray({ each: true })
  coordinates: number[][];
}

export class CreateRouteDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PathDto)
  path: PathDto;

  @IsString()
  @IsOptional()
  coverImage?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StopDto)
  @IsOptional()
  checkpoints?: StopDto[];

  @IsNumber()
  @IsOptional()
  distanceKm?: number;

  @IsNumber()
  @IsOptional()
  estimatedDurationMinutes?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
