import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesGateway } from './vehicles.gateway';

function getDistance(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number,
): number {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    private prisma: PrismaService,
    private vehiclesGateway: VehiclesGateway,
  ) {}

  // --- Fleet Management CRUD ---

  async findAllVehicles(): Promise<any[]> {
    const vehicles = await this.prisma.vehicle.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return vehicles.map((v) => ({ ...v, _id: v.id }));
  }

  async createVehicle(data: any): Promise<any> {
    const vehicle = await this.prisma.vehicle.create({
      data: {
        model: data.model,
        plateNumber: data.plateNumber,
        capacity: data.capacity !== undefined ? data.capacity : 14,
        driverId: data.driverId,
        type: data.type || 'SHUTTLE_BUS',
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
    return { ...vehicle, _id: vehicle.id };
  }

  async updateVehicle(id: string, data: any): Promise<any> {
    try {
      const vehicle = await this.prisma.vehicle.update({
        where: { id },
        data: {
          model: data.model,
          plateNumber: data.plateNumber,
          capacity: data.capacity,
          driverId: data.driverId,
          type: data.type,
          isActive: data.isActive,
        },
      });
      return { ...vehicle, _id: vehicle.id };
    } catch (err) {
      throw new NotFoundException('Vehicle not found');
    }
  }

  async deleteVehicle(id: string): Promise<any> {
    try {
      const vehicle = await this.prisma.vehicle.delete({ where: { id } });
      return { ...vehicle, _id: vehicle.id };
    } catch (err) {
      throw new NotFoundException('Vehicle not found');
    }
  }

  // --- Live Location Tracking ---

  async upsertLocation(data: {
    vehicleId: string;
    driverId: string;
    longitude: number;
    latitude: number;
  }): Promise<any> {
    this.logger.log(`Updating location for vehicle ${data.vehicleId}`);

    const existing = await this.prisma.liveVehicleLocation.findFirst({
      where: { vehicleId: data.vehicleId },
    });

    let updatedLocation;
    if (existing) {
      updatedLocation = await this.prisma.liveVehicleLocation.update({
        where: { id: existing.id },
        data: {
          driverId: data.driverId,
          location: {
            type: 'Point',
            coordinates: [data.longitude, data.latitude],
          } as any,
          lastUpdatedAt: new Date(),
        },
      });
    } else {
      updatedLocation = await this.prisma.liveVehicleLocation.create({
        data: {
          vehicleId: data.vehicleId,
          driverId: data.driverId,
          location: {
            type: 'Point',
            coordinates: [data.longitude, data.latitude],
          } as any,
          lastUpdatedAt: new Date(),
        },
      });
    }

    // Broadcast the updated location to connected clients
    this.vehiclesGateway.broadcastVehicleLocation(data.vehicleId, {
      longitude: data.longitude,
      latitude: data.latitude,
    });

    return { ...updatedLocation, _id: updatedLocation.id };
  }

  async getLocation(vehicleId: string): Promise<any> {
    const location = await this.prisma.liveVehicleLocation.findFirst({
      where: { vehicleId },
    });
    if (!location) {
      throw new NotFoundException(`No live location for vehicle ${vehicleId}`);
    }
    return { ...location, _id: location.id };
  }

  async getNearbyVehicles(
    lng: number,
    lat: number,
    radiusMeters: number = 3000,
  ): Promise<any[]> {
    this.logger.log(
      `Finding vehicles near [${lng}, ${lat}] within ${radiusMeters}m`,
    );
    const locations = await this.prisma.liveVehicleLocation.findMany();
    return locations
      .filter((loc: any) => {
        if (!loc.location || !loc.location.coordinates) return false;
        const [vLng, vLat] = loc.location.coordinates;
        return getDistance(lng, lat, vLng, vLat) <= radiusMeters;
      })
      .map((loc) => ({ ...loc, _id: loc.id }));
  }
}
