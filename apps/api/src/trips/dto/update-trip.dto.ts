import {
  IsUUID,
  IsDateString,
  IsEnum,
  IsNumber,
  Min,
  IsOptional,
  IsArray,
  ValidateIf,
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

  @ValidateIf((o) => o.priceEGP !== null && o.priceEGP !== undefined)
  @IsNumber()
  @Min(0)
  @IsOptional()
  priceEGP?: number | null;

  @ValidateIf((o) => o.premiumSeatSurcharge !== null && o.premiumSeatSurcharge !== undefined)
  @IsNumber()
  @Min(0)
  @IsOptional()
  premiumSeatSurcharge?: number | null;

  @ValidateIf((o) => o.availableSeats !== null && o.availableSeats !== undefined)
  @IsNumber()
  @Min(0)
  @IsOptional()
  availableSeats?: number | null;

  @ValidateIf((o) => o.bookedSeats !== null && o.bookedSeats !== undefined)
  @IsNumber()
  @Min(0)
  @IsOptional()
  bookedSeats?: number | null;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  lockedSeats?: number[];
}
