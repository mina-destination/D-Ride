import {
  IsUUID,
  IsNotEmpty,
  IsDateString,
  IsEnum,
  IsNumber,
  Min,
  IsOptional,
  IsArray,
} from 'class-validator';

export enum TripStatus {
  SCHEDULED = 'SCHEDULED',
  BOARDING = 'BOARDING',
  IN_TRANSIT = 'IN_TRANSIT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class CreateTripDto {
  @IsUUID()
  @IsNotEmpty()
  routeId: string;

  @IsUUID()
  @IsOptional()
  vehicleId?: string;

  @IsUUID()
  @IsOptional()
  driverId?: string;

  @IsDateString()
  @IsNotEmpty()
  departureTime: string;

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
  premiumSeatSurcharge?: number;

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
