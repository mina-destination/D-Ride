import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesGateway } from './vehicles.gateway';
import { getDistance } from '../utils/geo';

function mapVehicleFromDb(v: any): any {
  if (!v) return null;
  let make = '';
  let model = v.model;
  if (v.model && v.model.includes('::')) {
    const parts = v.model.split('::');
    make = parts[0];
    model = parts[1];
  } else if (v.model) {
    const spaceIdx = v.model.indexOf(' ');
    if (spaceIdx !== -1) {
      make = v.model.substring(0, spaceIdx);
      model = v.model.substring(spaceIdx + 1);
    } else {
      make = 'D-Ride';
      model = v.model;
    }
  }
  return {
    ...v,
    _id: v.id,
    make,
    model,
    licensePlate: v.plateNumber,
    status: v.isActive ? 'ACTIVE' : 'OUT_OF_SERVICE',
  };
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
      include: {
        locations: true,
        driver: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return vehicles.map(mapVehicleFromDb);
  }

  async createVehicle(data: any): Promise<any> {
    const combinedModel = `${data.make || ''}::${data.model || ''}`;
    const vehicle = await this.prisma.vehicle.create({
      data: {
        model: combinedModel,
        plateNumber: data.licensePlate || data.plateNumber,
        capacity: data.capacity !== undefined ? data.capacity : 14,
        driverId: data.driverId,
        type: data.type || 'SHUTTLE_BUS',
        isActive: data.status === 'ACTIVE' || data.isActive === true,
      },
    });
    return mapVehicleFromDb(vehicle);
  }

  async updateVehicle(id: string, data: any): Promise<any> {
    try {
      const combinedModel = `${data.make || ''}::${data.model || ''}`;
      const updateData: any = {};
      if (data.model !== undefined || data.make !== undefined) {
        updateData.model = combinedModel;
      }
      if (data.licensePlate !== undefined) {
        updateData.plateNumber = data.licensePlate;
      } else if (data.plateNumber !== undefined) {
        updateData.plateNumber = data.plateNumber;
      }
      if (data.capacity !== undefined) {
        updateData.capacity = data.capacity;
      }
      if (data.driverId !== undefined) {
        updateData.driverId = data.driverId;
      }
      if (data.type !== undefined) {
        updateData.type = data.type;
      }
      if (data.status !== undefined) {
        updateData.isActive = data.status === 'ACTIVE';
      } else if (data.isActive !== undefined) {
        updateData.isActive = data.isActive;
      }

      const vehicle = await this.prisma.vehicle.update({
        where: { id },
        data: updateData,
      });
      return mapVehicleFromDb(vehicle);
    } catch (err) {
      throw new NotFoundException('Vehicle not found');
    }
  }

  async deleteVehicle(id: string): Promise<any> {
    try {
      const vehicle = await this.prisma.vehicle.delete({ where: { id } });
      return mapVehicleFromDb(vehicle);
    } catch (err) {
      throw new NotFoundException('Vehicle not found');
    }
  }

  // --- Live Location Tracking ---

  async upsertLocation(
    data: {
      vehicleId: string;
      driverId: string;
      longitude: number;
      latitude: number;
    },
    caller?: { sub: string; role: string },
  ): Promise<any> {
    if (caller && caller.role === 'DRIVER') {
      if (data.driverId !== caller.sub) {
        throw new ForbiddenException('You cannot update location for another driver');
      }
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: data.vehicleId },
      });
      if (!vehicle || vehicle.driverId !== caller.sub) {
        throw new ForbiddenException('You are not assigned to this vehicle');
      }
    }

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

  async markVehicleOffline(vehicleId: string): Promise<any> {
    this.logger.log(`Marking vehicle ${vehicleId} status as OFFLINE`);
    const existing = await this.prisma.liveVehicleLocation.findFirst({
      where: { vehicleId },
    });
    if (existing) {
      return this.prisma.liveVehicleLocation.update({
        where: { id: existing.id },
        data: {
          status: 'OFFLINE',
          lastUpdatedAt: new Date(),
        },
      });
    }
  }
}
