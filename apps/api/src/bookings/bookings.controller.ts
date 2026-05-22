import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingEntity } from '../schemas/booking.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateBookingDto } from './dto/create-booking.dto';

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

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Request() req: any, @Body() data: CreateBookingDto) {
    // Force userId to be the authenticated user
    const bookingData = {
      ...data,
      userId: req.user.sub,
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
  async cancel(@Request() req: any, @Param('id') id: string) {
    const booking = await this.bookingsService.cancel(id, req.user.sub);
    return {
      success: true,
      data: booking,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('occupied/:tripId')
  async getOccupiedSeats(@Param('tripId') tripId: string) {
    const seats = await this.bookingsService.findOccupiedSeats(tripId);
    return { success: true, data: seats, timestamp: new Date().toISOString() };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DRIVER', 'ADMIN')
  @Get('trip/:tripId/manifest')
  async getTripManifest(@Param('tripId') tripId: string) {
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
  async checkIn(@Param('id') id: string) {
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
    @Param('id') id: string,
    @Body('token') token: string,
  ) {
    const booking = await this.bookingsService.verifyTicket(id, token);
    return {
      success: true,
      data: booking,
      timestamp: new Date().toISOString(),
    };
  }
}
