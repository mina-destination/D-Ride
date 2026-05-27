import { IsEnum, IsNotEmpty } from 'class-validator';
import { TripStatus } from './create-trip.dto';

export class UpdateTripStatusDto {
  @IsEnum(TripStatus)
  @IsNotEmpty()
  status: TripStatus;
}
