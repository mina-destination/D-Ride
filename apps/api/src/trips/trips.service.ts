import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TripStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { getVirtualRoute } from '../utils/routes';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';

import { VehiclesGateway } from '../vehicles/vehicles.gateway';

@Injectable()
export class TripsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private vehiclesGateway: VehiclesGateway,
    private configService: ConfigService,
  ) {}

  private mapTrip(
    trip: any,
    pickupCheckpointName?: string,
    dropoffCheckpointName?: string,
    virtualRouteId?: string,
  ): any {
    if (!trip) return null;

    let routeCopy: Prisma.RouteGetPayload<Record<string, never>> | null = null;
    let pickupCheckpoint: any = null;
    let dropoffCheckpoint: any = null;

    let actualPickupCpName = pickupCheckpointName;
    let actualDropoffCpName = dropoffCheckpointName;

    if (trip.route) {
      if (virtualRouteId && virtualRouteId.includes('_sub_')) {
        const parts = virtualRouteId.split('_sub_');
        const indices = parts[1].split('_');
        const startIndex = parseInt(indices[0], 10);
        const endIndex = parseInt(indices[1], 10);

        if (trip.route.checkpoints && Array.isArray(trip.route.checkpoints)) {
          const cps = trip.route.checkpoints as any[];
          if (cps[startIndex] && cps[endIndex]) {
            actualPickupCpName = actualPickupCpName || cps[startIndex].name;
            actualDropoffCpName = actualDropoffCpName || cps[endIndex].name;
          }
        }
        routeCopy = getVirtualRoute(trip.route, startIndex, endIndex);
      } else {
        routeCopy = { ...trip.route };
      }

      if (
        routeCopy &&
        routeCopy.checkpoints &&
        Array.isArray(routeCopy.checkpoints)
      ) {
        const depTime = new Date(trip.departureTime).getTime();

        let pickupIdx = -1;
        let dropoffIdx = -1;

        routeCopy.checkpoints.forEach((cp: any, idx: number) => {
          if (actualPickupCpName && cp.name === actualPickupCpName) {
            pickupIdx = idx;
          }
          if (actualDropoffCpName && cp.name === actualDropoffCpName) {
            dropoffIdx = idx;
          }
        });

        // Directional Sequence Validation: Enforce pickup is strictly before dropoff
        if (actualPickupCpName && actualDropoffCpName) {
          if (
            pickupIdx === -1 ||
            dropoffIdx === -1 ||
            pickupIdx >= dropoffIdx
          ) {
            return null; // Reject this candidate
          }
        }

        routeCopy.checkpoints = routeCopy.checkpoints.map((cp: any) => {
          const minutes = cp.minutesFromStart || 0;
          const offsetMs = minutes * 60 * 1000;
          const cpWithTimes = {
            ...cp,
            estimatedDepartureTime: new Date(depTime + offsetMs).toISOString(),
            estimatedArrivalTime: new Date(depTime + offsetMs).toISOString(),
          };

          if (actualPickupCpName && cp.name === actualPickupCpName) {
            pickupCheckpoint = {
              ...cpWithTimes,
              localizedDepartureTime: new Date(
                depTime + offsetMs,
              ).toISOString(),
            };
          }
          if (actualDropoffCpName && cp.name === actualDropoffCpName) {
            dropoffCheckpoint = {
              ...cpWithTimes,
              localizedArrivalTime: new Date(depTime + offsetMs).toISOString(),
            };
          }

          return cpWithTimes;
        });
      }
    }

    const t: Record<string, any> = { ...trip, _id: trip.id };
    if (routeCopy) {
      t.routeId = { ...routeCopy, _id: routeCopy.id };
    }

    if (pickupCheckpoint && dropoffCheckpoint) {
      let segmentPrice = 0;
      if (
        pickupCheckpoint.prices &&
        pickupCheckpoint.prices[dropoffCheckpoint.name] !== undefined
      ) {
        segmentPrice = Number(pickupCheckpoint.prices[dropoffCheckpoint.name]);
      } else {
        const pickupPrice = Number(pickupCheckpoint.priceFromStartEGP || 0);
        const dropoffPrice = Number(
          dropoffCheckpoint.priceFromStartEGP || trip.priceEGP || 0,
        );
        segmentPrice = dropoffPrice - pickupPrice;
      }
      t.priceEGP = segmentPrice;
      t.amountEGP = segmentPrice;
      t.localizedPriceEGP = segmentPrice;
    }

    if (pickupCheckpoint) {
      t.pickupCheckpoint = pickupCheckpoint;
    } else if (actualPickupCpName) {
      t.pickupCheckpoint = { name: actualPickupCpName };
    }

    if (dropoffCheckpoint) {
      t.dropoffCheckpoint = dropoffCheckpoint;
    } else if (actualDropoffCpName) {
      t.dropoffCheckpoint = { name: actualDropoffCpName };
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

    // Cleanup mapped properties
    delete t.route;

    if (trip.driver) {
      t.driverId = { ...trip.driver, _id: trip.driver.id };
      delete t.driverId.password;
      delete t.driver;
    }
    return t;
  }

  private async cleanupExpiredBookings(tripId: string): Promise<number> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const tripExists = await this.prisma.trip.findUnique({
      where: { id: tripId },
    });
    if (!tripExists) return 0;

    const expiredBookings = await this.prisma.booking.findMany({
      where: {
        tripId,
        status: 'PENDING_PAYMENT',
        createdAt: { lt: tenMinutesAgo },
      },
    });

    if (expiredBookings.length > 0) {
      const expiredIds = expiredBookings.map((b: any) => b.id);
      await this.prisma.booking.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: 'CANCELLED' },
      });
    }

    const activeBookings = await this.prisma.booking.findMany({
      where: {
        tripId,
        OR: [
          {
            status: {
              in: ['CONFIRMED', 'BOARDED', 'COMPLETED'],
            },
          },
          {
            status: 'PENDING_PAYMENT',
            createdAt: { gte: tenMinutesAgo },
          },
        ],
      },
      select: { seatNumbers: true },
    });

    let activeBookedCount = 0;
    activeBookings.forEach((b: any) => {
      if (b.seatNumbers && Array.isArray(b.seatNumbers)) {
        activeBookedCount += b.seatNumbers.length;
      }
    });

    await this.prisma.trip.update({
      where: { id: tripId },
      data: { bookedSeats: activeBookedCount },
    });

    return activeBookedCount;
  }

  async findAll(): Promise<any[]> {
    const trips = await this.prisma.trip.findMany({
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
      orderBy: { departureTime: 'asc' },
    });
    return trips.map((t) => this.mapTrip(t)).filter((t) => t !== null);
  }

  async findById(
    id: string,
    pickupCheckpointName?: string,
    dropoffCheckpointName?: string,
    virtualRouteId?: string,
  ): Promise<any> {
    await this.cleanupExpiredBookings(id);
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: {
        route: true,
        vehicle: true,
        driver: true,
      },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    const result = this.mapTrip(
      trip,
      pickupCheckpointName,
      dropoffCheckpointName,
      virtualRouteId,
    );
    if (!result) {
      throw new BadRequestException('Invalid route checkpoint sequence');
    }
    return result;
  }

  async searchTrips(
    routeId?: string,
    date?: string,
    pickupCheckpointName?: string,
    dropoffCheckpointName?: string,
  ): Promise<any[]> {
    // Note: Expired booking cleanup is handled lazily per-trip, not globally on every search.
    // This avoids a heavy global updateMany that becomes a bottleneck under load.

    const where: any = {
      status: TripStatus.SCHEDULED,
      route: {
        isActive: true,
        isDeleted: false,
      },
    };
    let actualRouteId = routeId;
    let actualPickupCpName = pickupCheckpointName;
    let actualDropoffCpName = dropoffCheckpointName;

    if (routeId && routeId.includes('_sub_')) {
      const parts = routeId.split('_sub_');
      const parentId = parts[0];
      const indices = parts[1].split('_');
      const startIndex = parseInt(indices[0], 10);
      const endIndex = parseInt(indices[1], 10);

      actualRouteId = parentId;

      const parentRoute = await this.prisma.route.findUnique({
        where: { id: parentId },
      });
      if (
        parentRoute &&
        parentRoute.checkpoints &&
        Array.isArray(parentRoute.checkpoints)
      ) {
        const cps = parentRoute.checkpoints as any[];
        if (cps[startIndex] && cps[endIndex]) {
          actualPickupCpName = actualPickupCpName || cps[startIndex].name;
          actualDropoffCpName = actualDropoffCpName || cps[endIndex].name;
        }
      }
    }

    if (actualRouteId) {
      where.routeId = actualRouteId;
    }

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      where.departureTime = { gte: startDate, lte: endDate };
    }

    // 2. Fetch the trips directly with their vehicle and driver details populated
    const trips = await this.prisma.trip.findMany({
      where,
      include: {
        route: {
          select: {
            id: true,
            name: true,
            coverImage: true,
            checkpoints: true,
            path: true,
            distanceKm: true,
            estimatedDurationMinutes: true,
            isActive: true,
            isDeleted: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        vehicle: true,
        driver: true,
      },
      orderBy: { departureTime: 'asc' },
    });

    if (trips.length === 0) {
      return [];
    }

    const tripIds = trips.map((t) => t.id);

    // 3. Batch query all active bookings for these trips in one single database roundtrip
    const activeBookings = await this.prisma.booking.findMany({
      where: {
        tripId: { in: tripIds },
        status: {
          in: ['CONFIRMED', 'BOARDED', 'COMPLETED', 'PENDING_PAYMENT'],
        },
      },
      select: {
        tripId: true,
        seatNumbers: true,
      },
    });

    // 4. Calculate the bookedSeats count dynamically in memory
    const bookedSeatsMap: Record<string, number> = {};
    activeBookings.forEach((b: any) => {
      const seatsCount =
        b.seatNumbers && Array.isArray(b.seatNumbers)
          ? b.seatNumbers.length
          : 0;
      bookedSeatsMap[b.tripId] = (bookedSeatsMap[b.tripId] || 0) + seatsCount;
    });

    // 5. Update the trips' bookedSeats in-memory to dynamically reflect active bookings
    return trips
      .map((t) => {
        t.bookedSeats = bookedSeatsMap[t.id] || 0;
        return this.mapTrip(
          t,
          actualPickupCpName,
          actualDropoffCpName,
          routeId,
        );
      })
      .filter((t) => t !== null);
  }

  async create(data: CreateTripDto): Promise<any> {
    const route = await this.prisma.route.findUnique({
      where: { id: data.routeId },
    });

    let finalPrice = Number(data.priceEGP);
    if (
      data.priceEGP === undefined ||
      data.priceEGP === null ||
      isNaN(finalPrice)
    ) {
      let calculatedPrice = route && route.priceEGP ? route.priceEGP : 0;
      if (
        !calculatedPrice &&
        route &&
        route.checkpoints &&
        Array.isArray(route.checkpoints)
      ) {
        const checkpoints = route.checkpoints as any[];
        if (checkpoints.length >= 2) {
          const startCp = checkpoints[0];
          const endCp = checkpoints[checkpoints.length - 1];
          if (startCp.prices && startCp.prices[endCp.name] !== undefined) {
            calculatedPrice = Number(startCp.prices[endCp.name]);
          } else {
            const prices = checkpoints
              .map((cp) => Number(cp.priceFromStartEGP || 0))
              .filter((p) => !isNaN(p));
            if (prices.length > 0) {
              calculatedPrice = Math.max(...prices);
            }
          }
        }
      }
      finalPrice = calculatedPrice;
    }

    let finalPremiumSurcharge = Number(data.premiumSeatSurcharge);
    if (
      data.premiumSeatSurcharge === undefined ||
      data.premiumSeatSurcharge === null ||
      isNaN(finalPremiumSurcharge)
    ) {
      finalPremiumSurcharge =
        route && route.premiumSeatSurcharge ? route.premiumSeatSurcharge : 0;
    }

    let finalSeats = Number(data.availableSeats);
    if (
      data.availableSeats === undefined ||
      data.availableSeats === null ||
      isNaN(finalSeats)
    ) {
      let seats = this.configService.get<number>(
        'defaults.vehicleCapacity',
        14,
      );
      if (data.vehicleId) {
        const vehicle = await this.prisma.vehicle.findUnique({
          where: { id: data.vehicleId },
        });
        if (vehicle && vehicle.capacity) {
          seats = vehicle.capacity;
        }
      }
      finalSeats = seats;
    }

    const depTime = new Date(data.departureTime);
    if (isNaN(depTime.getTime())) {
      throw new BadRequestException('Invalid departure time');
    }
    if (depTime < new Date()) {
      throw new BadRequestException('Departure time must be in the future');
    }
    let arrTime: Date | null = null;
    if (data.arrivalTime) {
      arrTime = new Date(data.arrivalTime);
      if (isNaN(arrTime.getTime())) {
        throw new BadRequestException('Invalid arrival time');
      }
      if (arrTime <= depTime) {
        throw new BadRequestException(
          'Arrival time must be after departure time',
        );
      }
    }

    const trip = await this.prisma.trip.create({
      data: {
        routeId: data.routeId,
        vehicleId: data.vehicleId,
        driverId: data.driverId,
        departureTime: depTime,
        arrivalTime: arrTime,
        status: (data.status || 'SCHEDULED').toUpperCase() as TripStatus,
        priceEGP: finalPrice,
        premiumSeatSurcharge: finalPremiumSurcharge,
        availableSeats: finalSeats,
        bookedSeats: Number(data.bookedSeats || 0),
        lockedSeats:
          data.lockedSeats ||
          this.configService.get('defaults.lockedSeats', [14]),
      },
      include: {
        route: true,
        vehicle: true,
        driver: true,
      },
    });
    return this.mapTrip(trip);
  }

  async update(id: string, data: UpdateTripDto): Promise<any> {
    const existing = await this.prisma.trip.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Trip not found');

    let depTime: Date = existing.departureTime;
    let arrTime: Date | null = existing.arrivalTime;
    let status: TripStatus | undefined;

    if (data.departureTime) {
      depTime = new Date(data.departureTime);
      if (isNaN(depTime.getTime())) {
        throw new BadRequestException('Invalid departure time');
      }
    }

    if (data.arrivalTime !== undefined) {
      if (data.arrivalTime === null) {
        arrTime = null;
      } else {
        arrTime = new Date(data.arrivalTime);
        if (isNaN(arrTime.getTime())) {
          throw new BadRequestException('Invalid arrival time');
        }
      }
    }

    if (arrTime && arrTime <= depTime) {
      throw new BadRequestException(
        'Arrival time must be after departure time',
      );
    }

    if (data.status) {
      status = data.status.toUpperCase() as TripStatus;
    }

    const updateData: Prisma.TripUpdateInput = {
      departureTime: depTime,
      arrivalTime: arrTime,
      status,
      ...(data.priceEGP != null ? { priceEGP: data.priceEGP } : {}),
      ...(data.premiumSeatSurcharge != null
        ? { premiumSeatSurcharge: data.premiumSeatSurcharge }
        : {}),
      ...(data.availableSeats != null
        ? { availableSeats: data.availableSeats }
        : {}),
      ...(data.bookedSeats != null ? { bookedSeats: data.bookedSeats } : {}),
      lockedSeats: data.lockedSeats,
    };

    try {
      const trip = await this.prisma.trip.update({
        where: { id },
        data: updateData,
        include: {
          route: true,
          vehicle: true,
          driver: true,
        },
      });
      return this.mapTrip(trip);
    } catch (err) {
      throw new NotFoundException('Trip not found');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const tripObj = await this.prisma.trip.findUnique({
        where: { id },
        select: { vehicleId: true },
      });

      const bookingsToNotify = await this.prisma.$transaction(async (tx) => {
        // 1. Soft-delete by setting trip status to CANCELLED
        await tx.trip.update({
          where: { id },
          data: { status: 'CANCELLED' },
        });

        // 2. Find all active bookings to notify before cancelling
        const activeBookings = await tx.booking.findMany({
          where: {
            tripId: id,
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

        // 3. Set all bookings of this trip to CANCELLED so they display as cancelled to the passengers
        await tx.booking.updateMany({
          where: { tripId: id },
          data: { status: 'CANCELLED' },
        });

        return activeBookings;
      });

      if (tripObj?.vehicleId) {
        try {
          await this.prisma.liveVehicleLocation.delete({
            where: { vehicleId: tripObj.vehicleId },
          });
        } catch (e) {
          // Ignore if no live location record exists
        }

        this.vehiclesGateway.server
          .to(`vehicle_${tripObj.vehicleId}`)
          .emit('vehicleOffline', {
            vehicleId: tripObj.vehicleId,
            timestamp: new Date().toISOString(),
          });
      }

      // 4. Send cancellation notification email/SMS/WhatsApp asynchronously
      for (const booking of bookingsToNotify) {
        try {
          const u = booking.user;
          const t = booking.trip;
          const r = t?.route;
          if (u && t && r) {
            const seatNo = Array.isArray(booking.seatNumbers)
              ? booking.seatNumbers.join(', ')
              : typeof booking.seatNumbers === 'string'
                ? booking.seatNumbers
                : typeof booking.seatNumbers === 'number'
                  ? String(booking.seatNumbers)
                  : '';
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
                  'Failed to send cancellation notification for booking asynchronously:',
                  booking.id,
                  notificationErr,
                );
              });
          }
        } catch (notificationErr) {
          console.error(
            'Failed to initiate cancellation notification for booking:',
            booking.id,
            notificationErr,
          );
        }
      }
    } catch (err: any) {
      console.error('DELETE TRIP ERROR:', err);
      throw new NotFoundException('Trip not found');
    }
  }

  async incrementBookedSeats(id: string, count: number): Promise<any> {
    const updated = await this.prisma.trip.update({
      where: {
        id,
        availableSeats: { gte: count }, // Atomic check
      },
      data: {
        bookedSeats: { increment: count },
        availableSeats: { decrement: count },
      },
      include: {
        route: true,
        vehicle: true,
        driver: true,
      },
    });
    if (!updated) throw new BadRequestException('Insufficient seats available');
    return this.mapTrip(updated);
  }

  async findByDriver(driverId: string): Promise<any[]> {
    const trips = await this.prisma.trip.findMany({
      where: {
        driverId,
        status: {
          not: 'CANCELLED',
        },
      },
      include: {
        route: true,
        vehicle: true,
        driver: true,
      },
      orderBy: { departureTime: 'asc' },
    });
    return trips.map((t) => this.mapTrip(t));
  }

  async updateTripStatus(
    tripId: string,
    driverId: string,
    status: string,
  ): Promise<any> {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');

    const caller = await this.prisma.user.findUnique({
      where: { id: driverId },
    });
    if (!caller) throw new NotFoundException('User not found');

    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'OPERATION'].includes(caller.role);

    if (!isAdmin) {
      if (!trip.driverId || trip.driverId !== driverId) {
        throw new ForbiddenException(
          'You are not authorized to update this trip status',
        );
      }
    }

    const validStatuses = [
      'SCHEDULED',
      'BOARDING',
      'IN_TRANSIT',
      'COMPLETED',
      'CANCELLED',
    ];
    if (!validStatuses.includes(status.toUpperCase())) {
      throw new BadRequestException('Invalid trip status');
    }

    const targetStatus = status.toUpperCase();
    if (
      !isAdmin &&
      ['BOARDING', 'IN_TRANSIT'].includes(targetStatus) &&
      trip.status === 'SCHEDULED'
    ) {
      const maxLeadTimeMs = 60 * 60 * 1000; // 1 hour
      const scheduledTime = new Date(trip.departureTime).getTime();
      const now = Date.now();
      if (now < scheduledTime - maxLeadTimeMs) {
        throw new BadRequestException(
          'You can only start this trip at most 1 hour before its scheduled departure time.',
        );
      }
    }

    const data: any = { status: status.toUpperCase() as TripStatus };
    if (status.toUpperCase() === 'COMPLETED') {
      data.arrivalTime = new Date();
    }

    const updated = await this.prisma.trip.update({
      where: { id: tripId },
      data,
      include: {
        route: true,
        vehicle: true,
        driver: true,
      },
    });

    if (updated.vehicleId) {
      this.vehiclesGateway.emitTripStatusUpdate(updated.vehicleId, {
        tripId: updated.id,
        status: updated.status,
      });

      if (updated.status === 'COMPLETED' || updated.status === 'CANCELLED') {
        try {
          await this.prisma.liveVehicleLocation.delete({
            where: { vehicleId: updated.vehicleId },
          });
        } catch (e) {
          // Ignore if no live location record exists
        }

        this.vehiclesGateway.server
          .to(`vehicle_${updated.vehicleId}`)
          .emit('vehicleOffline', {
            vehicleId: updated.vehicleId,
            timestamp: new Date().toISOString(),
          });
      }
    }

    return this.mapTrip(updated);
  }

  async getArrivedCheckpoints(tripId: string): Promise<string[]> {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (!trip.vehicleId) return [];
    return this.vehiclesGateway.getArrivedCheckpoints(trip.vehicleId);
  }

  async updateArrivedCheckpoints(
    tripId: string,
    arrivedCheckpoints: string[],
  ): Promise<string[]> {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (!trip.vehicleId) {
      throw new BadRequestException('No vehicle assigned to this trip');
    }
    await this.vehiclesGateway.setArrivedCheckpoints(
      trip.vehicleId,
      arrivedCheckpoints,
    );
    return arrivedCheckpoints;
  }
}
