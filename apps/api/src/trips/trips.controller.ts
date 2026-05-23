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
} from '@nestjs/common';
import { TripsService } from './trips.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';

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
  ) {
    const trips = await this.tripsService.searchTrips(routeId, date);
    return { success: true, data: trips, timestamp: new Date().toISOString() };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const trip = await this.tripsService.findById(id);
    return { success: true, data: trip, timestamp: new Date().toISOString() };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  async create(@Body() data: CreateTripDto) {
    const trip = await this.tripsService.create(data as any);
    return { success: true, data: trip, timestamp: new Date().toISOString() };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: UpdateTripDto) {
    const trip = await this.tripsService.update(id, data as any);
    return { success: true, data: trip, timestamp: new Date().toISOString() };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.tripsService.delete(id);
    return {
      success: true,
      message: 'Trip deleted',
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DRIVER', 'ADMIN')
  @Get('my-trips')
  async findMyTrips(@Request() req: any) {
    const trips = await this.tripsService.findByDriver(req.user.sub);
    return { success: true, data: trips, timestamp: new Date().toISOString() };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DRIVER', 'ADMIN')
  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @Request() req: any,
  ) {
    if (!body || !body.status) {
      throw new BadRequestException('Status is required');
    }
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
