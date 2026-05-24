import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PaymobModule } from './paymob/paymob.module';
import { RoutesModule } from './routes/routes.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { TripsModule } from './trips/trips.module';
import { BookingsModule } from './bookings/bookings.module';
import { UsersModule } from './users/users.module';
import { SupportModule } from './support/support.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReviewsModule } from './reviews/reviews.module';
import { PartnersModule } from './partners/partners.module';
import configuration from './config/configuration';

@Module({
  imports: [
    // Global configuration from environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Global Prisma Module for PostgreSQL connection
    PrismaModule,

    // Feature modules
    AuthModule,
    PaymobModule,
    RoutesModule,
    VehiclesModule,
    TripsModule,
    BookingsModule,
    UsersModule,
    SupportModule,
    NotificationsModule,
    ReviewsModule,
    PartnersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
