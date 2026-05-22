import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingEntity, BookingSchema } from '../schemas/booking.schema';
import { TripsModule } from '../trips/trips.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BookingEntity.name, schema: BookingSchema },
    ]),
    TripsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
