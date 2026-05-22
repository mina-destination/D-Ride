import {
  IsMongoId,
  IsNotEmpty,
  IsLatitude,
  IsLongitude,
} from 'class-validator';

export class UpdateLocationDto {
  @IsMongoId()
  @IsNotEmpty()
  vehicleId: string;

  @IsMongoId()
  @IsNotEmpty()
  driverId: string;

  @IsLongitude()
  @IsNotEmpty()
  longitude: number;

  @IsLatitude()
  @IsNotEmpty()
  latitude: number;
}
