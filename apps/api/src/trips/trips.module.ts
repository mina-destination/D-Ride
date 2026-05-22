import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { TripEntity, TripSchema } from '../schemas/trip.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TripEntity.name, schema: TripSchema }]),
  ],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
