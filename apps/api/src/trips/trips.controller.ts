import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TripsService } from './trips.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { UpdateTripStatusDto } from './dto/update-trip-status.dto';

@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  async findAll() {
    const trips = await this.tripsService.findAll();
    return { success: true, data: trips, timestamp: new Date().toISOString() };
  }

  @Get('search')
  async search(
    @Query('routeId') routeId?: string,
    @Query('date') date?: string,
    @Query('pickupCheckpointName') pickupCheckpointName?: string,
    @Query('dropoffCheckpointName') dropoffCheckpointName?: string,
  ) {
    const trips = await this.tripsService.searchTrips(
      routeId,
      date,
      pickupCheckpointName,
      dropoffCheckpointName,
    );
    return { success: true, data: trips, timestamp: new Date().toISOString() };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DRIVER', 'ADMIN')
  @Get('my-trips')
  async findMyTrips(@Request() req: any) {
    const trips = await this.tripsService.findByDriver(req.user.sub);
    return { success: true, data: trips, timestamp: new Date().toISOString() };
  }

  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('pickupCheckpointName') pickupCheckpointName?: string,
    @Query('dropoffCheckpointName') dropoffCheckpointName?: string,
    @Query('routeId') routeId?: string,
  ) {
    const trip = await this.tripsService.findById(
      id,
      pickupCheckpointName,
      dropoffCheckpointName,
      routeId,
    );
    return { success: true, data: trip, timestamp: new Date().toISOString() };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  async create(@Body() data: CreateTripDto) {
    const trip = await this.tripsService.create(data);
    return { success: true, data: trip, timestamp: new Date().toISOString() };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateTripDto,
  ) {
    const trip = await this.tripsService.update(id, data);
    return { success: true, data: trip, timestamp: new Date().toISOString() };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.tripsService.delete(id);
    return {
      success: true,
      message: 'Trip deleted',
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DRIVER', 'ADMIN')
  @Put(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTripStatusDto,
    @Request() req: any,
  ) {
    try {
      const trip = await this.tripsService.updateTripStatus(
        id,
        req.user.sub,
        body.status,
      );
      return { success: true, data: trip, timestamp: new Date().toISOString() };
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }
}
