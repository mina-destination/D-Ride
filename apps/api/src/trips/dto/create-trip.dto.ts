import {
  IsMongoId,
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
  @IsMongoId()
  @IsNotEmpty()
  routeId: string;

  @IsMongoId()
  @IsOptional()
  vehicleId?: string;

  @IsMongoId()
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
  priceEGP: number;

  @IsNumber()
  @Min(0)
  availableSeats: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  bookedSeats?: number;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  lockedSeats?: number[];
}
