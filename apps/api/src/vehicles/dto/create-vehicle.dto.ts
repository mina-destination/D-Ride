import {
  IsNotEmpty,
  IsString,
  IsNumber,
  Min,
  IsEnum,
  IsOptional,
} from 'class-validator';

export enum VehicleStatus {
  ACTIVE = 'ACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
}

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  make: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsString()
  @IsNotEmpty()
  licensePlate: string;

  @IsNumber()
  @Min(1)
  capacity: number;

  @IsEnum(VehicleStatus)
  status: VehicleStatus;

  @IsString()
  @IsOptional()
  driverId?: string;
}
