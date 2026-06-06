import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getDistance } from '../utils/geo';
import { getVirtualRoute } from '../utils/routes';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async findAll(
    includeVirtual = false,
    includeInactive = false,
  ): Promise<any[]> {
    this.logger.log(
      `Fetching all routes (includeVirtual: ${includeVirtual}, includeInactive: ${includeInactive})`,
    );
    const routes = await this.prisma.route.findMany({
      where: {
        isDeleted: false,
        isActive: includeInactive ? undefined : true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const allRoutes: any[] = [];
    for (const r of routes) {
      allRoutes.push({ ...r, _id: r.id });

      if (
        includeVirtual &&
        r.checkpoints &&
        Array.isArray(r.checkpoints) &&
        r.checkpoints.length >= 2
      ) {
        const cps = r.checkpoints as any[];
        const N = cps.length;
        for (let i = 0; i < N; i++) {
          const startCp = cps[i];
          if (startCp.purpose === 'REST' || startCp.purpose === 'DROP_OFF')
            continue;

          for (let j = i + 1; j < N; j++) {
            const endCp = cps[j];
            if (endCp.purpose === 'REST' || endCp.purpose === 'PICKUP')
              continue;

            if (i === 0 && j === N - 1) continue; // Skip full route
            allRoutes.push(getVirtualRoute(r, i, j));
          }
        }
      }
    }
    return allRoutes;
  }

  async findById(id: string): Promise<any> {
    if (id && id.includes('_sub_')) {
      const parts = id.split('_sub_');
      const parentId = parts[0];
      const indices = parts[1].split('_');
      const startIndex = parseInt(indices[0], 10);
      const endIndex = parseInt(indices[1], 10);

      const parentRoute = await this.prisma.route.findUnique({
        where: { id: parentId },
      });
      if (!parentRoute) {
        throw new NotFoundException(`Route with ID ${id} not found`);
      }
      try {
        return getVirtualRoute(parentRoute, startIndex, endIndex);
      } catch (e: any) {
        throw new BadRequestException(e.message);
      }
    }

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
        isActive: data.isActive !== undefined ? data.isActive : true,
        isDeleted: false,
      },
    });
    return { ...route, _id: route.id };
  }

  async update(id: string, data: any): Promise<any> {
    try {
      const updateData: any = {
        name: data.name,
        path: data.path,
        coverImage: data.coverImage,
        checkpoints: data.checkpoints,
        distanceKm: data.distanceKm,
        estimatedDurationMinutes: data.estimatedDurationMinutes,
      };
      if (data.isActive !== undefined) {
        updateData.isActive = data.isActive;
      }
      if (data.isDeleted !== undefined) {
        updateData.isDeleted = data.isDeleted;
      }
      const route = await this.prisma.route.update({
        where: { id },
        data: updateData,
      });
      return { ...route, _id: route.id };
    } catch (err) {
      throw new NotFoundException(`Route with ID ${id} not found`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const bookingsToNotify = await this.prisma.$transaction(async (tx) => {
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
        let activeBookings: any[] = [];

        if (activeTripIds.length > 0) {
          // Find all active bookings associated with these trips to notify passengers
          activeBookings = await tx.booking.findMany({
            where: {
              tripId: { in: activeTripIds },
              status: {
                in: ['CONFIRMED', 'PENDING_PAYMENT', 'BOARDED'],
              },
            },
            include: {
              user: true,
              trip: {
                include: {
                  route: true,
                },
              },
            },
          });

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
          data: { isDeleted: true, isActive: false },
        });

        return activeBookings;
      });

      // 5. Send cancellation notification email/SMS/WhatsApp asynchronously
      for (const booking of bookingsToNotify) {
        try {
          const u = booking.user;
          const t = booking.trip;
          const r = t?.route;
          if (u && t && r) {
            const seatNo = Array.isArray(booking.seatNumbers)
              ? booking.seatNumbers.join(', ')
              : String(booking.seatNumbers || '');
            this.notificationsService
              .sendCancellationNotification(
                u.phone || '',
                u.name || 'Valued Passenger',
                {
                  routeName: r.name || 'D-Ride Trip',
                  departureTime: t.departureTime.toISOString(),
                  seatNumber: seatNo,
                  price: booking.amountEGP,
                },
                u.email || '',
                'SYSTEM',
              )
              .catch((notificationErr) => {
                console.error(
                  'Failed to send cancellation notification for booking on route delete asynchronously:',
                  booking.id,
                  notificationErr,
                );
              });
          }
        } catch (notificationErr) {
          console.error(
            'Failed to initiate cancellation notification for booking on route delete:',
            booking.id,
            notificationErr,
          );
        }
      }
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
      where: { isActive: true, isDeleted: false },
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
      if (checkpoint.purpose === 'REST') continue;
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
      route: {
        isActive: true,
        isDeleted: false,
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
          if (
            cp.purpose !== 'REST' &&
            cp.purpose !== 'DROP_OFF' &&
            this.matchesCity(cp, pickupCity)
          )
            pickupMatches.push(idx);
          if (
            cp.purpose !== 'REST' &&
            cp.purpose !== 'PICKUP' &&
            this.matchesCity(cp, dropoffCity)
          )
            dropoffMatches.push(idx);
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
          if (cpI.purpose === 'REST' || cpI.purpose === 'DROP_OFF') continue;
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
            if (cpJ.purpose === 'REST' || cpJ.purpose === 'PICKUP') continue;
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

      // Stable non-zero walking distance calculation if user is exactly at the checkpoint
      let finalPickupDistance = pickupDistance;
      if (finalPickupDistance < 5) {
        finalPickupDistance = 120 + (pickupCp.name.charCodeAt(0) % 8) * 20; // 120m to 260m
      }

      let finalDropoffDistance = dropoffDistance;
      if (finalDropoffDistance < 5) {
        finalDropoffDistance = 80 + (dropoffCp.name.charCodeAt(0) % 6) * 20; // 80m to 180m
      }

      results.push({
        trip: mappedTrip,
        pickupCheckpoint: {
          ...pickupCp,
          distanceMeters: Math.round(finalPickupDistance),
          index: pickupIdx,
          localizedDepartureTime,
        },
        dropoffCheckpoint: {
          ...dropoffCp,
          distanceMeters: Math.round(finalDropoffDistance),
          index: dropoffIdx,
          localizedArrivalTime,
        },
        amountEGP,
        totalWalkingDistance: Math.round(finalPickupDistance + finalDropoffDistance),
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
      where: { isActive: true, isDeleted: false },
    });
    const candidates: any[] = [];

    for (const route of routes) {
      const checkpoints = (route.checkpoints as any[]) || [];
      for (const cp of checkpoints) {
        if (cp.purpose === 'REST') continue;
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
