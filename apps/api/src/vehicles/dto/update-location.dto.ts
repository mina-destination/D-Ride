import {
  IsUUID,
  IsNotEmpty,
  IsLatitude,
  IsLongitude,
} from 'class-validator';

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
}
