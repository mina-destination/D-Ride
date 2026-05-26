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
      select: {
        seatNumbers: true,
        pickupStopId: true,
        dropoffStopId: true,
      },
    });

    const trip = await prismaClient.trip.findUnique({
      where: { id: tripId },
      include: { route: true },
    });

    let peakBookedCount = 0;

    if (
      trip &&
      trip.route?.checkpoints &&
      Array.isArray(trip.route.checkpoints) &&
      trip.route.checkpoints.length >= 2
    ) {
      const routeCheckpoints = trip.route.checkpoints as any[];
      const segmentsCount = routeCheckpoints.length - 1;
      const bookedOnSegment = new Array(segmentsCount).fill(0);

      activeBookings.forEach((b: any) => {
        const seatsCount =
          b.seatNumbers && Array.isArray(b.seatNumbers)
            ? b.seatNumbers.length
            : 0;
        if (seatsCount === 0) return;

        const pCp = routeCheckpoints.find(
          (cp) => cp.id === b.pickupStopId || cp.name === b.pickupStopId,
        );
        const dCp = routeCheckpoints.find(
          (cp) => cp.id === b.dropoffStopId || cp.name === b.dropoffStopId,
        );

        let startIdx = 0;
        let endIdx = routeCheckpoints.length - 1;

        if (pCp && dCp) {
          const pIdx = routeCheckpoints.indexOf(pCp);
          const dIdx = routeCheckpoints.indexOf(dCp);
          if (pIdx >= 0 && dIdx >= 0 && pIdx < dIdx) {
            startIdx = pIdx;
            endIdx = dIdx;
          }
        }

        for (let i = startIdx; i < endIdx; i++) {
          bookedOnSegment[i] += seatsCount;
        }
      });

      peakBookedCount = Math.max(...bookedOnSegment, 0);
    } else {
      activeBookings.forEach((b: any) => {
        if (b.seatNumbers && Array.isArray(b.seatNumbers)) {
          peakBookedCount += b.seatNumbers.length;
        }
      });
    }

    await prismaClient.trip.update({
      where: { id: tripId },
      data: { bookedSeats: peakBookedCount },
    });

    return peakBookedCount;
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
        include: {
          route: true,
        },
      });
      if (!currentTrip) throw new NotFoundException('Trip not found');

      // Check if checkpoint-relative pricing and segment calculations apply
      const routeCheckpoints = (currentTrip.route?.checkpoints as any[]) || [];
      const pickupCp = routeCheckpoints.find(
        (cp) =>
          cp.id === data.pickupCheckpointId ||
          cp.name === data.pickupCheckpointId ||
          cp.name === data.pickupStopId,
      );
      const dropoffCp = routeCheckpoints.find(
        (cp) =>
          cp.id === data.dropoffCheckpointId ||
          cp.name === data.dropoffCheckpointId ||
          cp.name === data.dropoffStopId,
      );

      let segmentPrice = currentTrip.priceEGP || 0;
      let pickupCheckpointData = data.pickupCheckpoint || null;
      let dropoffCheckpointData = data.dropoffCheckpoint || null;

      if (pickupCp && dropoffCp) {
        const pickupIdx = routeCheckpoints.indexOf(pickupCp);
        const dropoffIdx = routeCheckpoints.indexOf(dropoffCp);
        if (pickupIdx >= dropoffIdx) {
          throw new BadRequestException(
            'Dropoff checkpoint must be after pickup checkpoint',
          );
        }

        const baseDepartureTimeMs = new Date(
          currentTrip.departureTime,
        ).getTime();
        const pickupOffsetMs = (pickupCp.minutesFromStart || 0) * 60 * 1000;
        const dropoffOffsetMs = (dropoffCp.minutesFromStart || 0) * 60 * 1000;

        const localizedDepartureTime = new Date(
          baseDepartureTimeMs + pickupOffsetMs,
        ).toISOString();
        const localizedArrivalTime = new Date(
          baseDepartureTimeMs + dropoffOffsetMs,
        ).toISOString();

        const pickupPrice = Number(pickupCp.priceFromStartEGP || 0);
        const dropoffPrice = Number(
          dropoffCp.priceFromStartEGP || currentTrip.priceEGP || 0,
        );
        const calcPrice = dropoffPrice - pickupPrice;
        if (calcPrice > 0) {
          segmentPrice = calcPrice;
        }

        pickupCheckpointData = {
          ...pickupCp,
          localizedDepartureTime,
        };
        dropoffCheckpointData = {
          ...dropoffCp,
          localizedArrivalTime,
        };
      }

      // Determine requested start and end indices on the route checkpoints
      let startReq = 0;
      let endReq = routeCheckpoints.length - 1;
      if (pickupCp && dropoffCp) {
        const pIdx = routeCheckpoints.indexOf(pickupCp);
        const dIdx = routeCheckpoints.indexOf(dropoffCp);
        if (pIdx >= 0 && dIdx >= 0 && pIdx < dIdx) {
          startReq = pIdx;
          endReq = dIdx;
        }
      }

      // 3. Enforce segment-based seat limit/bounds checks
      const activeBookingsForCounts = await tx.booking.findMany({
        where: {
          tripId: tripIdStr,
          status: {
            notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED],
          },
        },
        select: {
          seatNumbers: true,
          pickupStopId: true,
          dropoffStopId: true,
        },
      });

      if (routeCheckpoints.length >= 2) {
        const segmentsCount = routeCheckpoints.length - 1;
        const segmentOccupancy = new Array(segmentsCount).fill(0);

        activeBookingsForCounts.forEach((b: any) => {
          const seatsCount =
            b.seatNumbers && Array.isArray(b.seatNumbers)
              ? b.seatNumbers.length
              : 0;
          if (seatsCount === 0) return;

          const pCpB = routeCheckpoints.find(
            (cp) => cp.id === b.pickupStopId || cp.name === b.pickupStopId,
          );
          const dCpB = routeCheckpoints.find(
            (cp) => cp.id === b.dropoffStopId || cp.name === b.dropoffStopId,
          );

          let startB = 0;
          let endB = routeCheckpoints.length - 1;

          if (pCpB && dCpB) {
            const pIdx = routeCheckpoints.indexOf(pCpB);
            const dIdx = routeCheckpoints.indexOf(dCpB);
            if (pIdx >= 0 && dIdx >= 0 && pIdx < dIdx) {
              startB = pIdx;
              endB = dIdx;
            }
          }

          for (let i = startB; i < endB; i++) {
            segmentOccupancy[i] += seatsCount;
          }
        });

        for (let i = startReq; i < endReq; i++) {
          if (
            segmentOccupancy[i] + requestedSeats >
            currentTrip.availableSeats
          ) {
            throw new BadRequestException(
              'Not enough available seats on this segment',
            );
          }
        }
      } else {
        if (
          activeBookedSeatsCount + requestedSeats >
          currentTrip.availableSeats
        ) {
          throw new BadRequestException('Not enough available seats');
        }
      }

      // 4. Pull all active non-cancelled/non-refunded bookings to build the occupied seat indexes for this segment
      const activeBookings = await tx.booking.findMany({
        where: {
          tripId: tripIdStr,
          status: {
            notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED],
          },
        },
        select: {
          seatNumbers: true,
          pickupStopId: true,
          dropoffStopId: true,
        },
      });

      // Parse the seatNumbers JSON arrays along with the trip's administrative lockedSeats array into a flat memory Set of occupied seat indexes.
      const occupiedSeatIndexes = new Set<number>();

      const lockedSeatsList: number[] = Array.isArray(currentTrip.lockedSeats)
        ? (currentTrip.lockedSeats as number[])
        : [];
      lockedSeatsList.forEach((s) => occupiedSeatIndexes.add(Number(s)));

      activeBookings.forEach((b) => {
        if (b.seatNumbers && Array.isArray(b.seatNumbers)) {
          const pCpB = routeCheckpoints.find(
            (cp) => cp.id === b.pickupStopId || cp.name === b.pickupStopId,
          );
          const dCpB = routeCheckpoints.find(
            (cp) => cp.id === b.dropoffStopId || cp.name === b.dropoffStopId,
          );

          let startB = 0;
          let endB = routeCheckpoints.length - 1;

          if (pCpB && dCpB) {
            const pIdx = routeCheckpoints.indexOf(pCpB);
            const dIdx = routeCheckpoints.indexOf(dCpB);
            if (pIdx >= 0 && dIdx >= 0 && pIdx < dIdx) {
              startB = pIdx;
              endB = dIdx;
            }
          }

          const overlap = routeCheckpoints.length < 2 || (startReq < endB && startB < endReq);
          if (overlap) {
            b.seatNumbers.forEach((s) => occupiedSeatIndexes.add(Number(s)));
          }
        }
      });

      // Check the incoming data.seatNumbers array. If there is ANY structural index collision with an already occupied seat, throw a BadRequestException immediately.
      const hasCollision = requestedSeatsList.some((s) =>
        occupiedSeatIndexes.has(Number(s)),
      );
      if (hasCollision) {
        throw new BadRequestException(
          'One or more selected seats are already booked or locked on this segment',
        );
      }

      const amountEGP = segmentPrice * requestedSeats;
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

      // Generate a unique random boarding number from 1 to 99 for this trip
      const activeTripBookings = await tx.booking.findMany({
        where: {
          tripId: tripIdStr,
          status: {
            notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED],
          },
          boardingNumber: { not: null },
        },
        select: {
          boardingNumber: true,
        },
      });

      const usedBoardingNumbers = new Set(
        activeTripBookings.map((b) => b.boardingNumber),
      );

      const availableBoardingNumbers: number[] = [];
      for (let i = 1; i <= 99; i++) {
        if (!usedBoardingNumbers.has(i)) {
          availableBoardingNumbers.push(i);
        }
      }

      const boardingNumber =
        availableBoardingNumbers.length > 0
          ? availableBoardingNumbers[
              Math.floor(Math.random() * availableBoardingNumbers.length)
            ]
          : null;

      // Write the final booking entry ledger
      const newBooking = await tx.booking.create({
        data: {
          userId: data.userId.toString(),
          tripId: tripIdStr,
          seatNumbers: data.seatNumbers || [1],
          pickupStopId: data.pickupCheckpointId || data.pickupStopId || null,
          dropoffStopId: data.dropoffCheckpointId || data.dropoffStopId || null,
          pickupCheckpoint: pickupCheckpointData || null,
          dropoffCheckpoint: dropoffCheckpointData || null,
          status: bookingStatus,
          paymentStatus: paymentStatus,
          amountEGP,
          qrVerificationToken,
          boardingNumber,
        },
      });

      // Update the trip's bookedSeats to include the newly requested seats (peak segment-based occupancy)
      await this.cleanupExpiredBookings(tripIdStr, tx);

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

  async findOccupiedSeats(
    tripId: string,
    pickupCheckpointName?: string,
    dropoffCheckpointName?: string,
  ): Promise<number[]> {
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
        pickupStopId: true,
        dropoffStopId: true,
      },
    });

    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: { route: true },
    });

    const routeCheckpoints = (trip?.route?.checkpoints as any[]) || [];
    let startReq = 0;
    let endReq = routeCheckpoints.length - 1;

    if (
      pickupCheckpointName &&
      dropoffCheckpointName &&
      routeCheckpoints.length >= 2
    ) {
      const pCp = routeCheckpoints.find(
        (cp) =>
          cp.name === pickupCheckpointName || cp.id === pickupCheckpointName,
      );
      const dCp = routeCheckpoints.find(
        (cp) =>
          cp.name === dropoffCheckpointName || cp.id === dropoffCheckpointName,
      );
      if (pCp && dCp) {
        const pIdx = routeCheckpoints.indexOf(pCp);
        const dIdx = routeCheckpoints.indexOf(dCp);
        if (pIdx >= 0 && dIdx >= 0 && pIdx < dIdx) {
          startReq = pIdx;
          endReq = dIdx;
        }
      }
    }

    const occupied: number[] = [];
    bookings.forEach((b) => {
      if (b.seatNumbers && Array.isArray(b.seatNumbers)) {
        let shouldInclude = true;

        if (
          pickupCheckpointName &&
          dropoffCheckpointName &&
          routeCheckpoints.length >= 2
        ) {
          const pCpB = routeCheckpoints.find(
            (cp) => cp.id === b.pickupStopId || cp.name === b.pickupStopId,
          );
          const dCpB = routeCheckpoints.find(
            (cp) => cp.id === b.dropoffStopId || cp.name === b.dropoffStopId,
          );

          let startB = 0;
          let endB = routeCheckpoints.length - 1;

          if (pCpB && dCpB) {
            const pIdx = routeCheckpoints.indexOf(pCpB);
            const dIdx = routeCheckpoints.indexOf(dCpB);
            if (pIdx >= 0 && dIdx >= 0 && pIdx < dIdx) {
              startB = pIdx;
              endB = dIdx;
            }
          }

          const overlap = startReq < endB && startB < endReq;
          shouldInclude = overlap;
        }

        if (shouldInclude) {
          occupied.push(...(b.seatNumbers as number[]));
        }
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
