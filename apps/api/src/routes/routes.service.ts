import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getDistance } from '../utils/geo';

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<any[]> {
    this.logger.log('Fetching all routes');
    const routes = await this.prisma.route.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return routes.map((r) => ({ ...r, _id: r.id }));
  }

  async findById(id: string): Promise<any> {
    const route = await this.prisma.route.findUnique({ where: { id } });
    if (!route) {
      throw new NotFoundException(`Route with ID ${id} not found`);
    }
    return { ...route, _id: route.id };
  }

  async create(data: any): Promise<any> {
    this.logger.log(`Creating route: ${data.name}`);
    const route = await this.prisma.route.create({
      data: {
        name: data.name,
        path: data.path,
        coverImage: data.coverImage,
        checkpoints: data.checkpoints || [],
        distanceKm: data.distanceKm || 0,
        estimatedDurationMinutes: data.estimatedDurationMinutes || 0,
      },
    });
    return { ...route, _id: route.id };
  }

  async update(id: string, data: any): Promise<any> {
    try {
      const route = await this.prisma.route.update({
        where: { id },
        data: {
          name: data.name,
          path: data.path,
          coverImage: data.coverImage,
          checkpoints: data.checkpoints,
          distanceKm: data.distanceKm,
          estimatedDurationMinutes: data.estimatedDurationMinutes,
        },
      });
      return { ...route, _id: route.id };
    } catch (err) {
      throw new NotFoundException(`Route with ID ${id} not found`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Find all active trips on this route
        const activeTrips = await tx.trip.findMany({
          where: {
            routeId: id,
            status: {
              in: ['SCHEDULED', 'BOARDING', 'IN_TRANSIT'],
            },
          },
          select: { id: true },
        });

        const activeTripIds = activeTrips.map((t) => t.id);

        if (activeTripIds.length > 0) {
          // 2. Soft-delete/cancel all active trips on this route
          await tx.trip.updateMany({
            where: { id: { in: activeTripIds } },
            data: { status: 'CANCELLED' },
          });

          // 3. Cancel all bookings associated with these trips
          await tx.booking.updateMany({
            where: { tripId: { in: activeTripIds } },
            data: { status: 'CANCELLED' },
          });
        }

        // 4. Soft-delete the route
        await tx.route.update({
          where: { id },
          data: { isActive: false },
        });
      });
    } catch (err) {
      throw new NotFoundException(`Route with ID ${id} not found`);
    }
  }

  async findNearby(
    lng: number,
    lat: number,
    radiusMeters: number = 5000,
  ): Promise<any[]> {
    this.logger.log(
      `Finding routes near [${lng}, ${lat}] within ${radiusMeters}m`,
    );
    const deltaLat = radiusMeters / 111111;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const deltaLng = radiusMeters / (111111 * Math.abs(cosLat) || 1);

    const minLat = lat - deltaLat;
    const maxLat = lat + deltaLat;
    const minLng = lng - deltaLng;
    const maxLng = lng + deltaLng;

    const routes = await this.prisma.route.findMany({
      where: { isActive: true },
    });
    return routes
      .filter((route: any) => {
        if (!route.path || !route.path.coordinates) return false;
        return route.path.coordinates.some(([rLng, rLat]: [number, number]) => {
          // Bounding Box filter check first (extremely fast O(1) float comparison)
          if (
            rLat < minLat ||
            rLat > maxLat ||
            rLng < minLng ||
            rLng > maxLng
          ) {
            return false;
          }
          // Only compute full Haversine if inside bounding box
          return getDistance(lng, lat, rLng, rLat) <= radiusMeters;
        });
      })
      .map((r) => ({ ...r, _id: r.id }));
  }

  async findNearestCheckpoint(
    id: string,
    lng: number,
    lat: number,
  ): Promise<any> {
    const route = await this.findById(id);
    if (
      !route ||
      !route.checkpoints ||
      (route.checkpoints as any[]).length === 0
    ) {
      return null;
    }

    let closest: any = null;
    let minDistance = Infinity;

    for (const checkpoint of route.checkpoints as any[]) {
      if (!checkpoint.location || !checkpoint.location.coordinates) continue;
      const [cpLng, cpLat] = checkpoint.location.coordinates;
      const distance = getDistance(lng, lat, cpLng, cpLat);
      if (distance < minDistance) {
        minDistance = distance;
        closest = checkpoint;
      }
    }

    return closest;
  }

  private matchesCity(cp: any, city: string): boolean {
    if (!city) return false;
    const c = city.toLowerCase().trim();
    const cpCity = cp.city ? String(cp.city).toLowerCase().trim() : '';
    const cpName = cp.name ? String(cp.name).toLowerCase().trim() : '';
    const cpNameAr = cp.nameAr ? String(cp.nameAr).trim() : '';
    return (
      cpCity.includes(c) ||
      c.includes(cpCity) ||
      cpName.includes(c) ||
      c.includes(cpName) ||
      cpNameAr.includes(city.trim())
    );
  }

  private mapSearchTrip(trip: any) {
    const t = { ...trip, _id: trip.id };
    if (trip.route) {
      t.routeId = { ...trip.route, _id: trip.route.id };
      delete t.route;
    }
    if (trip.vehicle) {
      let make = '';
      let model = trip.vehicle.model;
      if (trip.vehicle.model && trip.vehicle.model.includes('::')) {
        const parts = trip.vehicle.model.split('::');
        make = parts[0];
        model = parts[1];
      } else if (trip.vehicle.model) {
        const spaceIdx = trip.vehicle.model.indexOf(' ');
        if (spaceIdx !== -1) {
          make = trip.vehicle.model.substring(0, spaceIdx);
          model = trip.vehicle.model.substring(spaceIdx + 1);
        } else {
          make = 'D-Ride';
          model = trip.vehicle.model;
        }
      }
      t.vehicleId = {
        ...trip.vehicle,
        _id: trip.vehicle.id,
        make,
        model,
        licensePlate: trip.vehicle.plateNumber,
        status: trip.vehicle.isActive ? 'ACTIVE' : 'OUT_OF_SERVICE',
      };
      delete t.vehicle;
    }
    if (trip.driver) {
      t.driverId = { ...trip.driver, _id: trip.driver.id };
      delete t.driverId.password;
      delete t.driver;
    }
    return t;
  }

  async smartSearch(
    pickupLng: number,
    pickupLat: number,
    dropoffLng: number,
    dropoffLat: number,
    radiusMeters: number = 5000,
    pickupCity?: string,
    dropoffCity?: string,
    date?: string,
  ): Promise<any[]> {
    this.logger.log(
      `Smart search: pickup=[${pickupLat},${pickupLng}] (${pickupCity}) dropoff=[${dropoffLat},${dropoffLng}] (${dropoffCity}) radius=${radiusMeters}m date=${date}`,
    );

    const where: any = {
      status: {
        in: ['SCHEDULED', 'BOARDING', 'IN_TRANSIT'],
      },
    };

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);

      const fromDate = new Date(startDate);
      fromDate.setDate(fromDate.getDate() - 1);

      const toDate = new Date(startDate);
      toDate.setDate(toDate.getDate() + 3);

      where.departureTime = {
        gte: fromDate,
        lte: toDate,
      };
    }

    const trips = await this.prisma.trip.findMany({
      where,
      include: {
        route: {
          select: {
            id: true,
            name: true,
            coverImage: true,
            checkpoints: true,
            distanceKm: true,
            estimatedDurationMinutes: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        vehicle: true,
        driver: true,
      },
    });

    const results: any[] = [];

    for (const trip of trips) {
      const checkpoints = (trip.route.checkpoints as any[]) || [];
      if (checkpoints.length < 2) continue;

      let pickupCp: any = null;
      let dropoffCp: any = null;
      let pickupIdx = -1;
      let dropoffIdx = -1;
      let pickupDistance = 0;
      let dropoffDistance = 0;

      if (pickupCity && dropoffCity) {
        // Try matching by city name first (search all matching, pick best directional pair)
        const pickupMatches: number[] = [];
        const dropoffMatches: number[] = [];
        checkpoints.forEach((cp, idx) => {
          if (this.matchesCity(cp, pickupCity)) pickupMatches.push(idx);
          if (this.matchesCity(cp, dropoffCity)) dropoffMatches.push(idx);
        });

        // Find best directional pair (pickup before dropoff)
        let foundCityMatch = false;
        for (const pIdx of pickupMatches) {
          for (const dIdx of dropoffMatches) {
            if (pIdx < dIdx) {
              pickupIdx = pIdx;
              dropoffIdx = dIdx;
              foundCityMatch = true;
              break;
            }
          }
          if (foundCityMatch) break;
        }

        if (foundCityMatch) {
          pickupCp = checkpoints[pickupIdx];
          dropoffCp = checkpoints[dropoffIdx];

          if (pickupLng && pickupLat) {
            pickupDistance = getDistance(
              pickupLng,
              pickupLat,
              pickupCp.location.coordinates[0],
              pickupCp.location.coordinates[1],
            );
          }
          if (dropoffLng && dropoffLat) {
            dropoffDistance = getDistance(
              dropoffLng,
              dropoffLat,
              dropoffCp.location.coordinates[0],
              dropoffCp.location.coordinates[1],
            );
          }
        }
        // If city match failed, fall through to coordinate matching below
        if (
          !foundCityMatch &&
          pickupLng &&
          pickupLat &&
          dropoffLng &&
          dropoffLat
        ) {
          // Fall through to coordinate-based matching
        } else if (!foundCityMatch) {
          continue;
        }
      }

      if (!pickupCp || !dropoffCp) {
        // Coordinate proximity based matching using strict sequence validator
        let optimalPickupCp: any = null;
        let optimalPickupIdx = -1;
        let optimalPickupDistance = Infinity;

        let optimalDropoffCp: any = null;
        let optimalDropoffIdx = -1;
        let optimalDropoffDistance = Infinity;

        let bestPairDistanceSum = Infinity;

        // Loop over checkpoints and ensure we only form pairs where i < j (pickup is strictly before dropoff)
        for (let i = 0; i < checkpoints.length; i++) {
          const cpI = checkpoints[i];
          if (!cpI.location?.coordinates) continue;
          const [cpILng, cpILat] = cpI.location.coordinates;
          const distToPickup = getDistance(
            pickupLng,
            pickupLat,
            cpILng,
            cpILat,
          );
          if (distToPickup > radiusMeters) continue;

          for (let j = i + 1; j < checkpoints.length; j++) {
            const cpJ = checkpoints[j];
            if (!cpJ.location?.coordinates) continue;
            const [cpJLng, cpJLat] = cpJ.location.coordinates;
            const distToDropoff = getDistance(
              dropoffLng,
              dropoffLat,
              cpJLng,
              cpJLat,
            );
            if (distToDropoff > radiusMeters) continue;

            const totalDist = distToPickup + distToDropoff;
            if (totalDist < bestPairDistanceSum) {
              bestPairDistanceSum = totalDist;
              optimalPickupCp = cpI;
              optimalPickupIdx = i;
              optimalPickupDistance = distToPickup;
              optimalDropoffCp = cpJ;
              optimalDropoffIdx = j;
              optimalDropoffDistance = distToDropoff;
            }
          }
        }

        if (bestPairDistanceSum === Infinity) {
          continue;
        }

        pickupCp = optimalPickupCp;
        pickupIdx = optimalPickupIdx;
        pickupDistance = optimalPickupDistance;
        dropoffCp = optimalDropoffCp;
        dropoffIdx = optimalDropoffIdx;
        dropoffDistance = optimalDropoffDistance;
      }

      // Final Directional Sequence Validation guard
      if (pickupIdx === -1 || dropoffIdx === -1 || pickupIdx >= dropoffIdx) {
        continue;
      }

      // Calculate timelines & leg dynamic segments
      const baseDepartureTimeMs = new Date(trip.departureTime).getTime();
      const pickupOffsetMs = (pickupCp.minutesFromStart || 0) * 60 * 1000;
      const dropoffOffsetMs = (dropoffCp.minutesFromStart || 0) * 60 * 1000;

      const localizedDepartureTime = new Date(
        baseDepartureTimeMs + pickupOffsetMs,
      ).toISOString();
      const localizedArrivalTime = new Date(
        baseDepartureTimeMs + dropoffOffsetMs,
      ).toISOString();

      let amountEGP = 0;
      if (pickupCp.prices && pickupCp.prices[dropoffCp.name] !== undefined) {
        amountEGP = Number(pickupCp.prices[dropoffCp.name]);
      } else {
        const pickupPrice = Number(pickupCp.priceFromStartEGP || 0);
        const dropoffPrice = Number(
          dropoffCp.priceFromStartEGP || trip.priceEGP || 0,
        );
        amountEGP = dropoffPrice - pickupPrice;
      }

      const mappedTrip = this.mapSearchTrip(trip);
      mappedTrip.priceEGP = amountEGP; // override trip priceEGP to be dynamic leg-based pricing
      mappedTrip.amountEGP = amountEGP;
      mappedTrip.localizedPriceEGP = amountEGP;

      results.push({
        trip: mappedTrip,
        pickupCheckpoint: {
          ...pickupCp,
          distanceMeters: Math.round(pickupDistance),
          index: pickupIdx,
          localizedDepartureTime,
        },
        dropoffCheckpoint: {
          ...dropoffCp,
          distanceMeters: Math.round(dropoffDistance),
          index: dropoffIdx,
          localizedArrivalTime,
        },
        amountEGP,
        totalWalkingDistance: Math.round(pickupDistance + dropoffDistance),
      });
    }

    results.sort((a, b) => a.totalWalkingDistance - b.totalWalkingDistance);
    return results;
  }

  async findNearestCheckpoints(
    lng: number,
    lat: number,
    limit: number = 5,
  ): Promise<any[]> {
    this.logger.log(`Finding nearest checkpoints to [${lng}, ${lat}]`);
    const routes = await this.prisma.route.findMany({
      where: { isActive: true },
    });
    const candidates: any[] = [];

    for (const route of routes) {
      const checkpoints = (route.checkpoints as any[]) || [];
      for (const cp of checkpoints) {
        if (!cp.location?.coordinates) continue;
        const [cpLng, cpLat] = cp.location.coordinates;
        const distance = getDistance(lng, lat, cpLng, cpLat);

        candidates.push({
          checkpoint: cp,
          route: {
            id: route.id,
            _id: route.id,
            name: route.name,
          },
          distanceMeters: Math.round(distance),
        });
      }
    }

    // Sort by distance ascending
    candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);

    return candidates.slice(0, limit);
  }
}
