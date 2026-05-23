import { Module } from '@nestjs/common';
import { PaymobController } from './paymob.controller';
import { PaymobService } from './paymob.service';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [BookingsModule],
  controllers: [PaymobController],
  providers: [PaymobService],
  exports: [PaymobService],
})
export class PaymobModule {}
