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

  async cleanupExpiredBookings(tripId: string, tx?: any): Promise<number> {
    const prismaClient = tx || this.prisma;
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const expiredBookings = await prismaClient.booking.findMany({
      where: {
        tripId,
        status: BookingStatus.PENDING_PAYMENT,
        createdAt: { lt: tenMinutesAgo },
      },
    });

    if (expiredBookings.length > 0) {
      const expiredIds = expiredBookings.map((b: any) => b.id);
      await prismaClient.booking.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: BookingStatus.CANCELLED },
      });
    }

    const activeBookings = await prismaClient.booking.findMany({
      where: {
        tripId,
        OR: [
          {
            status: {
              in: [
                BookingStatus.CONFIRMED,
                BookingStatus.BOARDED,
                BookingStatus.COMPLETED,
              ],
            },
          },
          {
            status: BookingStatus.PENDING_PAYMENT,
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

    await prismaClient.trip.update({
      where: { id: tripId },
      data: { bookedSeats: activeBookedCount },
    });

    return activeBookedCount;
  }

  async create(data: any): Promise<any> {
    const tripIdStr = data.tripId ? data.tripId.toString() : '';
    const requestedSeats = data.seatNumbers?.length || 1;
    const requestedSeatsList: number[] = data.seatNumbers || [1];
    const qrVerificationToken = crypto.randomBytes(16).toString('hex');

    const booking = await this.prisma.$transaction(async (tx) => {
      // 1. Clean up expired pending payments and recalculate current bookedSeats count
      const activeBookedSeatsCount = await this.cleanupExpiredBookings(
        tripIdStr,
        tx,
      );

      // 2. Retrieve the trip and acquire a database lock via findUnique
      const currentTrip = await tx.trip.findUnique({
        where: { id: tripIdStr },
      });
      if (!currentTrip) throw new NotFoundException('Trip not found');

      // 3. Enforce seat limit/bounds checks
      if (
        activeBookedSeatsCount + requestedSeats >
        currentTrip.availableSeats
      ) {
        throw new BadRequestException('Not enough available seats');
      }

      // 4. Pull all active non-cancelled/non-refunded bookings to build the occupied seat indexes
      const activeBookings = await tx.booking.findMany({
        where: {
          tripId: tripIdStr,
          status: {
            notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED],
          },
        },
        select: { seatNumbers: true },
      });

      // Parse the seatNumbers JSON arrays along with the trip's administrative lockedSeats array into a flat memory Set of occupied seat indexes.
      const occupiedSeatIndexes = new Set<number>();

      const lockedSeatsList: number[] = Array.isArray(currentTrip.lockedSeats)
        ? (currentTrip.lockedSeats as number[])
        : [];
      lockedSeatsList.forEach((s) => occupiedSeatIndexes.add(Number(s)));

      activeBookings.forEach((b) => {
        if (b.seatNumbers && Array.isArray(b.seatNumbers)) {
          b.seatNumbers.forEach((s) => occupiedSeatIndexes.add(Number(s)));
        }
      });

      // Check the incoming data.seatNumbers array. If there is ANY structural index collision with an already occupied seat, throw a BadRequestException immediately.
      const hasCollision = requestedSeatsList.some((s) =>
        occupiedSeatIndexes.has(Number(s)),
      );
      if (hasCollision) {
        throw new BadRequestException(
          'One or more selected seats are already booked or locked',
        );
      }

      const amountEGP = (currentTrip.priceEGP || 0) * requestedSeats;
      let bookingStatus: BookingStatus = BookingStatus.PENDING_PAYMENT;
      let paymentStatus: PaymentStatus = PaymentStatus.PENDING;

      const isWallet =
        data.paymentMethod === 'WALLET' ||
        data.paymentMethod === 'WALLET_BALANCE';

      if (isWallet) {
        const user = await tx.user.findUnique({
          where: { id: data.userId.toString() },
        });
        if (!user) throw new NotFoundException('User not found');

        if (user.walletBalance < amountEGP) {
          throw new BadRequestException('Insufficient wallet balance');
        }

        // Atomically decrement the balance field using database-level operations (decrement: totalCostEGP)
        await tx.user.update({
          where: { id: user.id },
          data: {
            walletBalance: { decrement: amountEGP },
          },
        });

        bookingStatus = BookingStatus.CONFIRMED;
        paymentStatus = PaymentStatus.SUCCESS;
      }

      // 5. Update the trip's bookedSeats to include the newly requested seats
      await tx.trip.update({
        where: { id: tripIdStr },
        data: {
          bookedSeats: activeBookedSeatsCount + requestedSeats,
        },
      });

      // Write the final booking entry ledger
      const newBooking = await tx.booking.create({
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
          status: bookingStatus,
          paymentStatus: paymentStatus,
          amountEGP,
          qrVerificationToken,
        },
      });

      // Create a successful matching record in the Transaction table instantly inside the transaction boundary if WALLET payment
      if (isWallet) {
        await tx.transaction.create({
          data: {
            bookingId: newBooking.id,
            userId: data.userId.toString(),
            amountEGP,
            status: PaymentStatus.SUCCESS,
            paymentMethod: data.paymentMethod || 'WALLET',
          },
        });
      }

      return newBooking;
    });

    // Trigger confirmation notification asynchronously if confirmed
    if (booking.status === BookingStatus.CONFIRMED) {
      try {
        const populated = await this.prisma.booking.findUnique({
          where: { id: booking.id },
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

    // Update bookedSeats of the trip dynamically (self-healing)
    await this.cleanupExpiredBookings(booking.tripId.toString());

    return this.mapBooking(updated);
  }

  async findOccupiedSeats(tripId: string): Promise<number[]> {
    await this.cleanupExpiredBookings(tripId);

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const bookings = await this.prisma.booking.findMany({
      where: {
        tripId,
        OR: [
          {
            status: {
              in: [
                BookingStatus.CONFIRMED,
                BookingStatus.BOARDED,
                BookingStatus.COMPLETED,
              ],
            },
          },
          {
            status: BookingStatus.PENDING_PAYMENT,
            createdAt: { gte: tenMinutesAgo },
          },
        ],
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

  async findOne(id: string, userId: string): Promise<any> {
    const booking = await this.prisma.booking.findFirst({
      where: { id, userId },
      include: {
        trip: {
          include: {
            route: true,
            vehicle: true,
            driver: true,
          },
        },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return this.mapBooking(booking);
  }
}
