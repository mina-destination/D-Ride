import { IsOptional, IsString, IsNumber, Min, IsEnum } from 'class-validator';
import { VehicleStatus } from './create-vehicle.dto';

export class UpdateVehicleDto {
  @IsString()
  @IsOptional()
  make?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  licensePlate?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsEnum(VehicleStatus)
  @IsOptional()
  status?: VehicleStatus;

  @IsString()
  @IsOptional()
  driverId?: string;
}
