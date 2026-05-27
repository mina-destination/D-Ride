import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TripStatus } from '@prisma/client';

@Injectable()
export class TripsService {
  constructor(private prisma: PrismaService) {}

  private mapTrip(
    trip: any,
    pickupCheckpointName?: string,
    dropoffCheckpointName?: string,
  ) {
    if (!trip) return null;

    let routeCopy: any = null;
    let pickupCheckpoint: any = null;
    let dropoffCheckpoint: any = null;

    if (trip.route) {
      routeCopy = { ...trip.route };
      if (routeCopy.checkpoints && Array.isArray(routeCopy.checkpoints)) {
        const depTime = new Date(trip.departureTime).getTime();

        let pickupIdx = -1;
        let dropoffIdx = -1;

        routeCopy.checkpoints.forEach((cp: any, idx: number) => {
          if (pickupCheckpointName && cp.name === pickupCheckpointName) {
            pickupIdx = idx;
          }
          if (dropoffCheckpointName && cp.name === dropoffCheckpointName) {
            dropoffIdx = idx;
          }
        });

        // Directional Sequence Validation: Enforce pickup is strictly before dropoff
        if (pickupCheckpointName && dropoffCheckpointName) {
          if (pickupIdx === -1 || dropoffIdx === -1 || pickupIdx >= dropoffIdx) {
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

          if (pickupCheckpointName && cp.name === pickupCheckpointName) {
            pickupCheckpoint = {
              ...cpWithTimes,
              localizedDepartureTime: new Date(depTime + offsetMs).toISOString(),
            };
          }
          if (dropoffCheckpointName && cp.name === dropoffCheckpointName) {
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
      if (pickupCheckpoint.prices && pickupCheckpoint.prices[dropoffCheckpoint.name] !== undefined) {
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
    } else if (pickupCheckpointName) {
      t.pickupCheckpoint = { name: pickupCheckpointName };
    }

    if (dropoffCheckpoint) {
      t.dropoffCheckpoint = dropoffCheckpoint;
    } else if (dropoffCheckpointName) {
      t.dropoffCheckpoint = { name: dropoffCheckpointName };
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
        route: true,
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
    const result = this.mapTrip(trip, pickupCheckpointName, dropoffCheckpointName);
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
    const where: any = { status: TripStatus.SCHEDULED };
    if (routeId) {
      where.routeId = routeId;
    }
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      where.departureTime = { gte: startDate, lte: endDate };
    }
    const trips = await this.prisma.trip.findMany({
      where,
      include: {
        route: true,
      },
      orderBy: { departureTime: 'asc' },
    });

    // Clean up expired bookings for all found scheduled trips in parallel to correct their bookedSeats counts
    await Promise.all(trips.map((t) => this.cleanupExpiredBookings(t.id)));

    // Re-fetch trips to get the updated database states
    const updatedTrips = await this.prisma.trip.findMany({
      where,
      include: {
        route: true,
        vehicle: true,
        driver: true,
      },
      orderBy: { departureTime: 'asc' },
    });

    return updatedTrips
      .map((t) => this.mapTrip(t, pickupCheckpointName, dropoffCheckpointName))
      .filter((t) => t !== null);
  }

  async create(data: any): Promise<any> {
    let finalPrice = Number(data.priceEGP);
    if (data.priceEGP === undefined || data.priceEGP === null || isNaN(finalPrice)) {
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
    if (data.availableSeats === undefined || data.availableSeats === null || isNaN(finalSeats)) {
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

    const trip = await this.prisma.trip.create({
      data: {
        routeId: data.routeId,
        vehicleId: data.vehicleId,
        driverId: data.driverId,
        departureTime: new Date(data.departureTime),
        arrivalTime: data.arrivalTime ? new Date(data.arrivalTime) : null,
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
    const updateData = { ...data };
    if (updateData.departureTime) {
      updateData.departureTime = new Date(updateData.departureTime);
    }
    if (updateData.arrivalTime) {
      updateData.arrivalTime = new Date(updateData.arrivalTime);
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

    if (trip.driverId && trip.driverId !== driverId) {
      throw new ForbiddenException(
        'You are not authorized to update this trip status',
      );
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
