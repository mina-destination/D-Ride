import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TripStatus } from '@prisma/client';
import { getVirtualRoute } from '../utils/routes';

@Injectable()
export class TripsService {
  constructor(private prisma: PrismaService) {}

  private mapTrip(
    trip: any,
    pickupCheckpointName?: string,
    dropoffCheckpointName?: string,
    virtualRouteId?: string,
  ) {
    if (!trip) return null;

    let routeCopy: any = null;
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

      if (routeCopy.checkpoints && Array.isArray(routeCopy.checkpoints)) {
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

    const t = { ...trip, _id: trip.id };
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

    const where: any = { status: TripStatus.SCHEDULED };
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
      if (parentRoute && parentRoute.checkpoints && Array.isArray(parentRoute.checkpoints)) {
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
        return this.mapTrip(t, actualPickupCpName, actualDropoffCpName, routeId);
      })
      .filter((t) => t !== null);
  }

  async create(data: any): Promise<any> {
    let finalPrice = Number(data.priceEGP);
    if (
      data.priceEGP === undefined ||
      data.priceEGP === null ||
      isNaN(finalPrice)
    ) {
      const route = await this.prisma.route.findUnique({
        where: { id: data.routeId },
      });
      let calculatedPrice = 0;
      if (route && route.checkpoints && Array.isArray(route.checkpoints)) {
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

    let finalSeats = Number(data.availableSeats);
    if (
      data.availableSeats === undefined ||
      data.availableSeats === null ||
      isNaN(finalSeats)
    ) {
      let seats = 14;
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
        availableSeats: finalSeats,
        bookedSeats: Number(data.bookedSeats || 0),
        lockedSeats: data.lockedSeats || [14],
      },
    });
    return this.mapTrip(trip);
  }

  async update(id: string, data: any): Promise<any> {
    const existing = await this.prisma.trip.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Trip not found');

    const updateData = { ...data };
    let depTime = existing.departureTime;
    let arrTime = existing.arrivalTime;

    if (updateData.departureTime) {
      depTime = new Date(updateData.departureTime);
      if (isNaN(depTime.getTime())) {
        throw new BadRequestException('Invalid departure time');
      }
      if (depTime < new Date()) {
        throw new BadRequestException('Departure time must be in the future');
      }
      updateData.departureTime = depTime;
    }

    if (updateData.arrivalTime !== undefined) {
      if (updateData.arrivalTime === null) {
        arrTime = null;
      } else {
        arrTime = new Date(updateData.arrivalTime);
        if (isNaN(arrTime.getTime())) {
          throw new BadRequestException('Invalid arrival time');
        }
        updateData.arrivalTime = arrTime;
      }
    }

    if (arrTime && arrTime <= depTime) {
      throw new BadRequestException(
        'Arrival time must be after departure time',
      );
    }

    if (updateData.status) {
      updateData.status = updateData.status.toUpperCase() as TripStatus;
    }

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
      await this.prisma.$transaction(async (tx) => {
        // 1. Soft-delete by setting trip status to CANCELLED
        await tx.trip.update({
          where: { id },
          data: { status: 'CANCELLED' },
        });

        // 2. Set all bookings of this trip to CANCELLED so they display as cancelled to the passengers
        await tx.booking.updateMany({
          where: { tripId: id },
          data: { status: 'CANCELLED' },
        });
      });
    } catch (err) {
      throw new NotFoundException('Trip not found');
    }
  }

  async incrementBookedSeats(id: string, count: number): Promise<any> {
    const trip = await this.prisma.trip.findUnique({ where: { id } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.bookedSeats + count > trip.availableSeats) {
      throw new Error('Not enough available seats');
    }
    const updated = await this.prisma.trip.update({
      where: { id },
      data: {
        bookedSeats: { increment: count },
      },
      include: {
        route: true,
        vehicle: true,
        driver: true,
      },
    });
    return this.mapTrip(updated);
  }

  async findByDriver(driverId: string): Promise<any[]> {
    const trips = await this.prisma.trip.findMany({
      where: { driverId },
      include: {
        route: true,
        vehicle: true,
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
    return this.mapTrip(updated);
  }
}
