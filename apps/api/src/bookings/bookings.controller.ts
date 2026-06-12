import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  async findAll() {
    const bookings = await this.bookingsService.findAll();
    return {
      success: true,
      data: bookings,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-bookings')
  async findMyBookings(@Request() req: any) {
    const bookings = await this.bookingsService.findMyBookings(req.user.sub);
    return {
      success: true,
      data: bookings,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post()
  async create(@Request() req: any, @Body() data: CreateBookingDto) {
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'OWNER', 'OPERATION'].includes(
      req.user.role,
    );
    const bookingData = {
      ...data,
      userId: isAdmin && data.userId ? data.userId : req.user.sub,
    };
    const booking = await this.bookingsService.create(bookingData as any);
    return {
      success: true,
      data: booking,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/cancel')
  async cancel(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const booking = await this.bookingsService.cancel(
      id,
      req.user.sub,
      req.user.role,
    );
    return {
      success: true,
      data: booking,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/apply-promo')
  async applyPromo(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('code') code: string | null,
  ) {
    const booking = await this.bookingsService.applyPromoCode(
      id,
      req.user.sub,
      code,
    );
    return {
      success: true,
      data: booking,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('occupied/:tripId')
  async getOccupiedSeats(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Query('pickupCheckpointName') pickupCheckpointName?: string,
    @Query('dropoffCheckpointName') dropoffCheckpointName?: string,
  ) {
    const seats = await this.bookingsService.findOccupiedSeats(
      tripId,
      pickupCheckpointName,
      dropoffCheckpointName,
    );
    return { success: true, data: seats, timestamp: new Date().toISOString() };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DRIVER', 'ADMIN')
  @Get('trip/:tripId/manifest')
  async getTripManifest(@Param('tripId', ParseUUIDPipe) tripId: string) {
    const manifest = await this.bookingsService.findTripManifest(tripId);
    return {
      success: true,
      data: manifest,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DRIVER', 'ADMIN')
  @Put(':id/check-in')
  async checkIn(@Param('id', ParseUUIDPipe) id: string) {
    const booking = await this.bookingsService.checkInPassenger(id);
    return {
      success: true,
      data: booking,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DRIVER', 'ADMIN')
  @Put(':id/verify-ticket')
  async verifyTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('token') token: string,
  ) {
    const booking = await this.bookingsService.verifyTicket(id, token);
    return {
      success: true,
      data: booking,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':id/refund')
  async refundBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('action') action?: 'FULL' | 'HALF' | 'REJECT',
  ) {
    const booking = await this.bookingsService.refundBooking(id, action);
    return {
      success: true,
      data: booking,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('track-by-code/:code')
  async trackByCode(@Request() req: any, @Param('code', ParseUUIDPipe) code: string) {
    const userRole = req.user.role;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'OWNER', 'OPERATION'].includes(userRole);
    const isDriver = userRole === 'DRIVER';
    
    // Pass userId for ownership check (admins/drivers can track any)
    const trackingInfo = await this.bookingsService.trackByCode(
      code,
      isAdmin || isDriver ? undefined : req.user.sub,
    );
    return {
      success: true,
      data: trackingInfo,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findById(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const booking = await this.bookingsService.findOne(id, req.user.sub);
    return {
      success: true,
      data: booking,
      timestamp: new Date().toISOString(),
    };
  }
}
