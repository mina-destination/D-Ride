import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
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
    @Inject(forwardRef(() => VehiclesGateway))
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
      speedKmh?: number;
      headingDegrees?: number;
    },
    caller?: { sub: string; role: string },
  ): Promise<any> {
    if (caller && caller.role === 'DRIVER') {
      if (data.driverId !== caller.sub) {
        throw new ForbiddenException(
          'You cannot update location for another driver',
        );
      }
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: data.vehicleId },
      });
      if (!vehicle) {
        throw new NotFoundException('Vehicle not found');
      }

      let isAuthorized = vehicle.driverId === caller.sub;

      if (!isAuthorized) {
        const activeTrip = await this.prisma.trip.findFirst({
          where: {
            vehicleId: data.vehicleId,
            driverId: caller.sub,
            status: { in: ['SCHEDULED', 'BOARDING', 'IN_TRANSIT'] },
          },
        });
        if (activeTrip) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        throw new ForbiddenException(
          'You are not assigned to this vehicle or active trip',
        );
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
          speedKmh: data.speedKmh ?? 0,
          headingDegrees: data.headingDegrees ?? 0,
          status: 'ACTIVE',
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
          speedKmh: data.speedKmh ?? 0,
          headingDegrees: data.headingDegrees ?? 0,
          lastUpdatedAt: new Date(),
        },
      });
    }

    // Record actual path trace if there is an active in-transit trip
    try {
      if (this.prisma.trip) {
        const activeTrip = await this.prisma.trip.findFirst({
          where: {
            vehicleId: data.vehicleId,
            driverId: data.driverId,
            status: 'IN_TRANSIT',
          },
          include: {
            route: true,
          },
        });

        if (activeTrip) {
          let path: [number, number][] = [];
          if (activeTrip.actualPath) {
            try {
              path =
                typeof activeTrip.actualPath === 'string'
                  ? JSON.parse(activeTrip.actualPath)
                  : (activeTrip.actualPath as any);
            } catch (e) {
              path = [];
            }
          }
          if (!Array.isArray(path)) {
            path = [];
          }

          const last = path[path.length - 1];
          if (
            !last ||
            last[0] !== data.longitude ||
            last[1] !== data.latitude
          ) {
            path.push([data.longitude, data.latitude]);
            await this.prisma.trip.update({
              where: { id: activeTrip.id },
              data: {
                actualPath: path as any,
              },
            });
          }

          // Estimate ETA to the next unarrived checkpoint
          if (activeTrip.route && activeTrip.route.checkpoints) {
            const checkpoints = (activeTrip.route.checkpoints as any[]) || [];
            if (checkpoints.length > 0) {
              const arrivedCheckpoints = await this.vehiclesGateway.getArrivedCheckpoints(data.vehicleId);
              
              // Find the first checkpoint that is not arrived
              const nextCheckpoint = checkpoints.find(
                (cp) => !arrivedCheckpoints.includes(cp.name),
              );

              if (nextCheckpoint && nextCheckpoint.location?.coordinates) {
                const [cpLng, cpLat] = nextCheckpoint.location.coordinates;
                const distanceMeters = getDistance(data.longitude, data.latitude, cpLng, cpLat);

                const routeDistKm = activeTrip.route.distanceKm || 15;
                const routeDurationMin = activeTrip.route.estimatedDurationMinutes || 30;
                let avgSpeedKmh = (routeDistKm / (routeDurationMin / 60)) || 45;
                if (avgSpeedKmh < 15) avgSpeedKmh = 15;
                if (avgSpeedKmh > 100) avgSpeedKmh = 100;

                const currentSpeedKmh = data.speedKmh ?? 0;
                const speedKmh = currentSpeedKmh < 10 ? avgSpeedKmh : Math.max(10, Math.min(currentSpeedKmh, 120));
                
                const speedMetersPerMinute = (speedKmh * 1000) / 60;
                const etaMinutes = Math.max(1, Math.round(distanceMeters / speedMetersPerMinute));

                this.vehiclesGateway.emitEtaUpdate(data.vehicleId, {
                  vehicleId: data.vehicleId,
                  nextCheckpoint: nextCheckpoint.name,
                  etaMinutes,
                  distanceMeters: Math.round(distanceMeters),
                  timestamp: new Date().toISOString(),
                });
              }
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to record actual trip path coordinates/ETA: ${err.message}`,
      );
    }

    // Broadcast the updated location to connected clients
    this.vehiclesGateway.broadcastVehicleLocation(data.vehicleId, {
      longitude: data.longitude,
      latitude: data.latitude,
      speed: data.speedKmh ?? 0,
      heading: data.headingDegrees ?? 0,
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

  async getAllLocations(): Promise<any[]> {
    try {
      return await this.prisma.liveVehicleLocation.findMany({
        include: {
          vehicle: {
            select: {
              id: true,
              model: true,
              plateNumber: true,
              capacity: true,
              type: true,
              driverId: true,
              driver: { select: { id: true, name: true, phone: true } },
            },
          },
        },
        orderBy: { lastUpdatedAt: 'desc' },
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to fetch all vehicle locations: ${err.message}`,
      );
      return [];
    }
  }

  async getLocationWithDetails(vehicleId: string): Promise<any> {
    const location = await this.prisma.liveVehicleLocation.findFirst({
      where: { vehicleId },
      include: {
        vehicle: {
          select: {
            id: true,
            model: true,
            plateNumber: true,
            capacity: true,
            type: true,
            driverId: true,
            driver: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    });
    if (!location) {
      throw new NotFoundException(`No live location for vehicle ${vehicleId}`);
    }
    return location;
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
