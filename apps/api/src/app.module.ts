import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
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
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { PromoCodesModule } from './promo-codes/promo-codes.module';
import { TransactionsModule } from './transactions/transactions.module';
import { HealthModule } from './health/health.module';
import configuration from './config/configuration';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import {
  RequestIdMiddleware,
  RequestLoggerMiddleware,
} from './utils/security.middleware';

@Module({
  imports: [
    // Global configuration from environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Global Prisma Module for PostgreSQL connection
    PrismaModule,

    // Task Scheduling
    ScheduleModule.forRoot(),

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
    WhatsappModule,
    PromoCodesModule,
    TransactionsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, RequestLoggerMiddleware).forRoutes('*');
  }
}
