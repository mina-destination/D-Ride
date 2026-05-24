import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TripsService } from '../trips/trips.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BookingStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private tripsService: TripsService,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
  ) {}

  private mapBooking(booking: any) {
    if (!booking) return null;
    const b = { ...booking, _id: booking.id };
    if (booking.trip) {
      const tripPopulated = {
        ...booking.trip,
        _id: booking.trip.id,
      };
      if (booking.trip.route) {
        tripPopulated.routeId = {
          ...booking.trip.route,
          _id: booking.trip.route.id,
        };
        delete tripPopulated.route;
      }
      if (booking.trip.driver) {
        tripPopulated.driver = {
          ...booking.trip.driver,
          _id: booking.trip.driver.id,
        };
        delete tripPopulated.driver.password;
      }
      if (booking.trip.vehicle) {
        tripPopulated.vehicle = {
          ...booking.trip.vehicle,
          _id: booking.trip.vehicle.id,
        };
      }
      b.tripId = tripPopulated;
      delete b.trip;
    }
    if (booking.user) {
      b.userId = { ...booking.user, _id: booking.user.id };
      delete b.userId.password;
      delete b.user;
    }
    return b;
  }

  async findAll(): Promise<any[]> {
    const bookings = await this.prisma.booking.findMany({
      include: {
        trip: {
          include: {
            route: true,
          },
        },
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return bookings.map((b) => this.mapBooking(b));
  }

  async findMyBookings(userId: string): Promise<any[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { userId },
      include: {
        trip: {
          include: {
            route: true,
            driver: true,
            vehicle: true,
          },
        },
        review: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return bookings.map((b) => this.mapBooking(b));
  }

  async create(data: any): Promise<any> {
    // 1. Fetch trip to check seats
    const tripIdStr = data.tripId ? data.tripId.toString() : '';
    const trip = await this.tripsService.findById(tripIdStr);
    if (!trip) throw new NotFoundException('Trip not found');

    const requestedSeats = data.seatNumbers?.length || 1;
    if (trip.bookedSeats + requestedSeats > trip.availableSeats) {
      throw new BadRequestException('Not enough available seats');
    }

    const amountEGP = (trip.priceEGP || 0) * requestedSeats;
    const qrVerificationToken = crypto.randomBytes(16).toString('hex');

    // 2. Perform atomic seat increment and booking creation in a transaction
    const booking = await this.prisma.$transaction(async (tx) => {
      const currentTrip = await tx.trip.findUnique({
        where: { id: tripIdStr },
      });
      if (!currentTrip) throw new NotFoundException('Trip not found');
      if (currentTrip.bookedSeats + requestedSeats > currentTrip.availableSeats) {
        throw new BadRequestException('Not enough available seats');
      }

      await tx.trip.update({
        where: { id: tripIdStr },
        data: {
          bookedSeats: { increment: requestedSeats },
        },
      });

      return tx.booking.create({
        data: {
          userId: data.userId.toString(),
          tripId: tripIdStr,
          seatNumbers: data.seatNumbers || [1],
          pickupStopId: data.pickupStopId ? data.pickupStopId.toString() : null,
          dropoffStopId: data.dropoffStopId
            ? data.dropoffStopId.toString()
            : null,
          pickupCheckpoint: data.pickupCheckpoint || null,
          dropoffCheckpoint: data.dropoffCheckpoint || null,
          status: BookingStatus.PENDING_PAYMENT,
          paymentStatus: PaymentStatus.PENDING,
          amountEGP,
          qrVerificationToken,
        },
      });
    });

    return this.mapBooking(booking);
  }

  async updateStatus(id: string, status: string): Promise<any> {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');

    const saved = await this.prisma.booking.update({
      where: { id },
      data: { status: status.toUpperCase() as BookingStatus },
    });

    if (status.toUpperCase() === 'CONFIRMED') {
      try {
        const populated = await this.prisma.booking.findUnique({
          where: { id },
          include: {
            trip: {
              include: {
                route: true,
              },
            },
            user: true,
          },
        });

        if (populated) {
          const u = populated.user;
          const t = populated.trip;
          const r = t?.route;
          const seatsStr =
            (populated.seatNumbers as any[])?.join(', ') || 'N/A';

          await this.notificationsService.sendBookingConfirmation(
            u?.phone || '',
            u?.name || 'Valued Passenger',
            {
              routeName: r?.name || 'D-Ride Minibus Trip',
              departureTime: t?.departureTime
                ? t.departureTime.toISOString()
                : new Date().toISOString(),
              seatNumber: seatsStr,
              price: populated.amountEGP || 0,
            },
          );
        }
      } catch (err) {
        console.error('Failed to dispatch notification:', err);
      }
    }

    return this.mapBooking(saved);
  }

  async cancel(id: string, userId: string): Promise<any> {
    const booking = await this.prisma.booking.findFirst({
      where: { id, userId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status === BookingStatus.CANCELLED)
      throw new BadRequestException('Booking already cancelled');

    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
    });

    // Decrement seats (we pass negative count)
    const seatsCount = (booking.seatNumbers as any[])?.length || 1;
    await this.tripsService.incrementBookedSeats(
      booking.tripId.toString(),
      -seatsCount,
    );

    return this.mapBooking(updated);
  }

  async findOccupiedSeats(tripId: string): Promise<number[]> {
    const bookings = await this.prisma.booking.findMany({
      where: {
        tripId,
        status: { not: BookingStatus.CANCELLED },
      },
      select: {
        seatNumbers: true,
      },
    });

    const occupied: number[] = [];
    bookings.forEach((b) => {
      if (b.seatNumbers && Array.isArray(b.seatNumbers)) {
        occupied.push(...(b.seatNumbers as number[]));
      }
    });
    return occupied;
  }

  async findTripManifest(tripId: string): Promise<any[]> {
    const bookings = await this.prisma.booking.findMany({
      where: {
        tripId,
        status: { not: BookingStatus.CANCELLED },
      },
      include: {
        user: true,
      },
    });
    return bookings.map((b) => this.mapBooking(b));
  }

  async checkInPassenger(bookingId: string): Promise<any> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (
      booking.status !== BookingStatus.CONFIRMED &&
      booking.status !== BookingStatus.PENDING
    ) {
      if (booking.status === BookingStatus.CANCELLED) {
        throw new BadRequestException('Booking has been cancelled');
      }
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.BOARDED },
    });
    return this.mapBooking(updated);
  }

  async verifyTicket(id: string, token: string): Promise<any> {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.qrVerificationToken !== token) {
      throw new BadRequestException('Invalid ticket verification token');
    }

    if (booking.status === BookingStatus.BOARDED) {
      return this.mapBooking(booking);
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking has been cancelled');
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        `Booking status is ${booking.status}, expected CONFIRMED`,
      );
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.BOARDED },
    });
    return this.mapBooking(updated);
  }
}
