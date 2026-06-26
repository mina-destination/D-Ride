import { IsUUID, IsNotEmpty, IsLatitude, IsLongitude, IsOptional, IsNumber } from 'class-validator';

export class UpdateLocationDto {
  @IsUUID()
  @IsNotEmpty()
  vehicleId: string;

  @IsUUID()
  @IsNotEmpty()
  driverId: string;

  @IsLongitude()
  @IsNotEmpty()
  longitude: number;

  @IsLatitude()
  @IsNotEmpty()
  latitude: number;

  @IsOptional()
  @IsNumber()
  speedKmh?: number;

  @IsOptional()
  @IsNumber()
  headingDegrees?: number;

  @IsOptional()
  @IsNumber()
  batteryPercentage?: number;
}
