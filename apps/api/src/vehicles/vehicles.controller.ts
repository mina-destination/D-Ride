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
} from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  // --- Fleet Management CRUD ---

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  async getAllVehicles() {
    return this.vehiclesService.findAllVehicles();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  async createVehicle(@Body() data: CreateVehicleDto) {
    return this.vehiclesService.createVehicle(data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':id')
  async updateVehicle(@Param('id') id: string, @Body() data: UpdateVehicleDto) {
    return this.vehiclesService.updateVehicle(id, data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  async deleteVehicle(@Param('id') id: string) {
    return this.vehiclesService.deleteVehicle(id);
  }

  // --- Live Location Tracking ---

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DRIVER', 'ADMIN')
  @Post('location')
  async updateLocation(@Request() req: any, @Body() data: UpdateLocationDto) {
    const location = await this.vehiclesService.upsertLocation(data, req.user);
    return {
      success: true,
      data: location,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('location/:vehicleId')
  async getLocation(@Param('vehicleId') vehicleId: string) {
    const location = await this.vehiclesService.getLocation(vehicleId);
    return {
      success: true,
      data: location,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('nearby')
  async getNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ) {
    const vehicles = await this.vehiclesService.getNearbyVehicles(
      parseFloat(lng),
      parseFloat(lat),
      radius ? parseInt(radius, 10) : 3000,
    );
    return {
      success: true,
      data: vehicles,
      timestamp: new Date().toISOString(),
    };
  }
}
