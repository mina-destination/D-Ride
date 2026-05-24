import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TripStatus } from '@prisma/client';

@Injectable()
export class TripsService {
  constructor(private prisma: PrismaService) {}

  private mapTrip(trip: any) {
    if (!trip) return null;
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

  async findAll(): Promise<any[]> {
    const trips = await this.prisma.trip.findMany({
      include: {
        route: true,
        vehicle: true,
        driver: true,
      },
      orderBy: { departureTime: 'asc' },
    });
    return trips.map((t) => this.mapTrip(t));
  }

  async findById(id: string): Promise<any> {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: {
        route: true,
        vehicle: true,
        driver: true,
      },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    return this.mapTrip(trip);
  }

  async searchTrips(routeId?: string, date?: string): Promise<any[]> {
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
    return trips.map((t) => this.mapTrip(t));
  }

  async create(data: any): Promise<any> {
    const trip = await this.prisma.trip.create({
      data: {
        routeId: data.routeId,
        vehicleId: data.vehicleId,
        driverId: data.driverId,
        departureTime: new Date(data.departureTime),
        arrivalTime: data.arrivalTime ? new Date(data.arrivalTime) : null,
        status: (data.status || 'SCHEDULED').toUpperCase() as TripStatus,
        priceEGP: Number(data.priceEGP),
        availableSeats: Number(data.availableSeats),
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
      await this.prisma.trip.delete({ where: { id } });
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
      throw new Error('You are not authorized to update this trip status');
    }

    const validStatuses = [
      'SCHEDULED',
      'BOARDING',
      'IN_TRANSIT',
      'COMPLETED',
      'CANCELLED',
    ];
    if (!validStatuses.includes(status.toUpperCase())) {
      throw new Error('Invalid trip status');
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
