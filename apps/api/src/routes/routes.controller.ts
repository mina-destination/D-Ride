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
} from '@nestjs/common';
import { RoutesService } from './routes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';

@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  async findAll() {
    const routes = await this.routesService.findAll();
    return { success: true, data: routes, timestamp: new Date().toISOString() };
  }

  @Get('nearby')
  async findNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ) {
    const routes = await this.routesService.findNearby(
      parseFloat(lng),
      parseFloat(lat),
      radius ? parseInt(radius, 10) : 5000,
    );
    return { success: true, data: routes, timestamp: new Date().toISOString() };
  }

  @Get('smart-search')
  async smartSearch(
    @Query('pickupLat') pickupLat: string,
    @Query('pickupLng') pickupLng: string,
    @Query('dropoffLat') dropoffLat: string,
    @Query('dropoffLng') dropoffLng: string,
    @Query('radius') radius?: string,
  ) {
    const results = await this.routesService.smartSearch(
      parseFloat(pickupLng),
      parseFloat(pickupLat),
      parseFloat(dropoffLng),
      parseFloat(dropoffLat),
      radius ? parseInt(radius, 10) : 5000,
    );
    return {
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const route = await this.routesService.findById(id);
    return { success: true, data: route, timestamp: new Date().toISOString() };
  }

  @Get(':id/nearest-checkpoint')
  async findNearestCheckpoint(
    @Param('id') id: string,
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    const checkpoint = await this.routesService.findNearestCheckpoint(
      id,
      parseFloat(lng),
      parseFloat(lat),
    );
    return {
      success: true,
      data: checkpoint,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  async create(@Body() data: CreateRouteDto) {
    const route = await this.routesService.create(data as any);
    return { success: true, data: route, timestamp: new Date().toISOString() };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: UpdateRouteDto) {
    const route = await this.routesService.update(id, data as any);
    return { success: true, data: route, timestamp: new Date().toISOString() };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.routesService.delete(id);
    return {
      success: true,
      message: 'Route deleted',
      timestamp: new Date().toISOString(),
    };
  }
}
