import {
  IsUUID,
  IsDateString,
  IsEnum,
  IsNumber,
  Min,
  IsOptional,
  IsArray,
} from 'class-validator';
import { TripStatus } from './create-trip.dto';

export class UpdateTripDto {
  @IsUUID()
  @IsOptional()
  routeId?: string;

  @IsUUID()
  @IsOptional()
  vehicleId?: string;

  @IsUUID()
  @IsOptional()
  driverId?: string;

  @IsDateString()
  @IsOptional()
  departureTime?: string;

  @IsDateString()
  @IsOptional()
  arrivalTime?: string;

  @IsEnum(TripStatus)
  @IsOptional()
  status?: TripStatus;

  @IsNumber()
  @Min(0)
  @IsOptional()
  priceEGP?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  availableSeats?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  bookedSeats?: number;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  lockedSeats?: number[];
}
