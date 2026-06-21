import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TripsService } from '../trips/trips.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Prisma, BookingStatus, PaymentStatus } from '@prisma/client';
import { CreateBookingDto } from './dto/create-booking.dto';

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
    if (booking.transactions) {
      const successTx = booking.transactions.find(
        (t: any) => t.status === 'SUCCESS' && t.paymobPaymentId,
      );
      if (successTx) {
        b.paymobPaymentId = successTx.paymobPaymentId;
      }
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
        transactions: true,
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
  private calculateBasePrice(
    trip: any,
    segmentPrice: number,
    seatNumbers: number[],
    customSurcharge?: number,
  ): number {
    const surcharge =
      customSurcharge !== undefined
        ? customSurcharge
        : Number(trip.premiumSeatSurcharge || 0);
    const hasSeat1 = seatNumbers.some((s) => Number(s) === 1);
    return segmentPrice * seatNumbers.length + (hasSeat1 ? surcharge : 0);
  }

  async cleanupExpiredBookings(tripId: string, tx?: any): Promise<number> {
    const prismaClient = tx || this.prisma;
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const expiredBookings = await prismaClient.booking.findMany({
      where: {
        tripId,
        status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.PENDING] },
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
            status: {
              in: [BookingStatus.PENDING_PAYMENT, BookingStatus.PENDING],
            },
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

  async create(data: CreateBookingDto): Promise<any> {
    const tripIdStr = data.tripId ? data.tripId.toString() : '';
    const requestedSeats = data.seatNumbers?.length || 1;
    const requestedSeatsList: number[] = data.seatNumbers || [1];
    const qrVerificationToken = crypto.randomBytes(16).toString('hex');

    const booking = await this.prisma.$transaction(
      async (tx) => {
        // 0. Acquire exclusive row-level lock on the trip via findUnique with Serializable isolation
        // The transaction isolation level (set below) ensures row locking on read
        const currentTrip = await tx.trip.findUnique({
          where: { id: tripIdStr },
          include: {
            route: true,
            vehicle: true,
          },
        });
        if (!currentTrip) throw new NotFoundException('Trip not found');

        // 1. Clean up expired pending payments and recalculate current bookedSeats count
        let activeBookedSeatsCount = await this.cleanupExpiredBookings(
          tripIdStr,
          tx,
        );

        // 2.5. Prevent duplicate pending bookings for the same user on the same trip
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const userId = data.userId?.toString() || '';
        const existingPending = await tx.booking.findFirst({
          where: {
            userId,
            tripId: tripIdStr,
            status: {
              in: [BookingStatus.PENDING_PAYMENT, BookingStatus.PENDING],
            },
            createdAt: { gte: tenMinutesAgo },
          },
        });
        if (existingPending) {
          // Auto-cancel old pending booking so user can rebook without getting stuck
          await tx.booking.update({
            where: { id: existingPending.id },
            data: { status: BookingStatus.CANCELLED },
          });
          activeBookedSeatsCount = await this.cleanupExpiredBookings(
            tripIdStr,
            tx,
          );
        }

        // Enforce bounds checks on requested seat numbers
        const capacity = currentTrip.vehicle?.capacity || 14;
        for (const seat of requestedSeatsList) {
          if (!Number.isInteger(seat) || seat < 1 || seat > capacity) {
            throw new BadRequestException(
              `Invalid seat number: ${seat}. Seat numbers must be integers between 1 and ${capacity}.`,
            );
          }
        }

        // Check if checkpoint-relative pricing and segment calculations apply
        const routeCheckpoints =
          (currentTrip.route?.checkpoints as any[]) || [];
        const pickupCp = routeCheckpoints.find(
          (cp) =>
            (data.pickupCheckpointId &&
              (cp.id === data.pickupCheckpointId ||
                cp.name === data.pickupCheckpointId)) ||
            (data.pickupStopId && cp.name === data.pickupStopId),
        );
        const dropoffCp = routeCheckpoints.find(
          (cp) =>
            (data.dropoffCheckpointId &&
              (cp.id === data.dropoffCheckpointId ||
                cp.name === data.dropoffCheckpointId)) ||
            (data.dropoffStopId && cp.name === data.dropoffStopId),
        );

        if (pickupCp) {
          if (pickupCp.purpose === 'REST' || pickupCp.purpose === 'DROP_OFF') {
            throw new BadRequestException(
              `Selected pickup checkpoint "${pickupCp.name}" is not available for boarding`,
            );
          }
        }
        if (dropoffCp) {
          if (dropoffCp.purpose === 'REST' || dropoffCp.purpose === 'PICKUP') {
            throw new BadRequestException(
              `Selected dropoff checkpoint "${dropoffCp.name}" is not available for drop-off`,
            );
          }
        }

        let segmentPrice = currentTrip.priceEGP || 0;
        let customSurcharge: number | undefined;
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

          if (
            pickupCp.prices &&
            pickupCp.prices[dropoffCp.name] !== undefined
          ) {
            segmentPrice = Number(pickupCp.prices[dropoffCp.name]);
          } else {
            const pickupPrice = Number(pickupCp.priceFromStartEGP || 0);
            const dropoffPrice = Number(
              dropoffCp.priceFromStartEGP || currentTrip.priceEGP || 0,
            );
            segmentPrice = dropoffPrice - pickupPrice;
          }

          if (
            pickupCp.premiumSurcharges &&
            pickupCp.premiumSurcharges[dropoffCp.name] !== undefined
          ) {
            customSurcharge = Number(
              pickupCp.premiumSurcharges[dropoffCp.name],
            );
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

            const overlap =
              routeCheckpoints.length < 2 ||
              (startReq < endB && startB < endReq);
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

        const isReward = !!data.isReward;
        const basePrice = isReward
          ? 0
          : this.calculateBasePrice(
              currentTrip,
              segmentPrice,
              requestedSeatsList,
              customSurcharge,
            );

        let discountEGP = 0;
        let promoCodeId: string | null = null;
        let amountEGP = basePrice;

        if (data.promoCode && !isReward) {
          const codeNormalized = data.promoCode.trim().toUpperCase();
          const promo = await tx.promoCode.findUnique({
            where: { code: codeNormalized },
          });

          if (promo && promo.isActive) {
            const isNotExpired =
              !promo.expiryDate || new Date() <= new Date(promo.expiryDate);
            const isUnderLimit =
              promo.usageLimit === null || promo.usageCount < promo.usageLimit;
            const meetsMinAmount = basePrice >= promo.minBookingAmountEGP;

            if (isNotExpired && isUnderLimit && meetsMinAmount) {
              promoCodeId = promo.id;
              if (promo.discountType === 'FIXED') {
                discountEGP = promo.discountValue;
              } else if (promo.discountType === 'PERCENTAGE') {
                discountEGP = basePrice * (promo.discountValue / 100);
                if (promo.maxDiscountEGP !== null) {
                  discountEGP = Math.min(discountEGP, promo.maxDiscountEGP);
                }
              }
              discountEGP = Math.min(discountEGP, basePrice);
              amountEGP = basePrice - discountEGP;
            }
          }
        }

        const bookingStatus: BookingStatus = isReward
          ? BookingStatus.CONFIRMED
          : BookingStatus.PENDING_PAYMENT;
        const paymentStatus: PaymentStatus = isReward
          ? PaymentStatus.SUCCESS
          : PaymentStatus.PENDING;

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
        const bookingUserId = data.userId?.toString() || '';
        const newBooking = await tx.booking.create({
          data: {
            userId: bookingUserId,
            tripId: tripIdStr,
            seatNumbers: data.seatNumbers || [1],
            pickupStopId: data.pickupCheckpointId || data.pickupStopId || null,
            dropoffStopId:
              data.dropoffCheckpointId || data.dropoffStopId || null,
            pickupCheckpoint:
              (pickupCheckpointData as unknown as Prisma.InputJsonValue) ??
              null,
            dropoffCheckpoint:
              (dropoffCheckpointData as unknown as Prisma.InputJsonValue) ??
              null,
            status: bookingStatus,
            paymentStatus: paymentStatus,
            amountEGP,
            discountEGP,
            promoCodeId,
            qrVerificationToken,
            boardingNumber,
          },
        });

        // Update the promo code usage count if wallet payment instantly confirms it
        if (bookingStatus === BookingStatus.CONFIRMED && promoCodeId) {
          await tx.promoCode.update({
            where: { id: promoCodeId },
            data: { usageCount: { increment: 1 } },
          });
        }

        // Update the trip's bookedSeats to include the newly requested seats (peak segment-based occupancy)
        await this.cleanupExpiredBookings(tripIdStr, tx);

        // Create a successful matching record in the Transaction table instantly inside the transaction boundary if REWARD payment
        if (isReward) {
          await tx.transaction.create({
            data: {
              bookingId: newBooking.id,
              userId: data.userId?.toString() || '',
              amountEGP,
              status: PaymentStatus.SUCCESS,
              paymentMethod: data.paymentMethod || 'ADMIN_REWARD',
            },
          });
        }

        return newBooking;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      },
    );

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
            u?.email || '',
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

    if (
      status.toUpperCase() === 'CONFIRMED' &&
      booking.status !== BookingStatus.CONFIRMED &&
      booking.promoCodeId
    ) {
      try {
        await this.prisma.promoCode.update({
          where: { id: booking.promoCodeId },
          data: { usageCount: { increment: 1 } },
        });
      } catch (err) {
        console.error('Failed to increment promo code usage count:', err);
      }
    }

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
            u?.email || '',
          );
        }
      } catch (err) {
        console.error('Failed to dispatch notification:', err);
      }
    }

    return this.mapBooking(saved);
  }

  async cancel(id: string, userId: string, userRole?: string): Promise<any> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const isAdmin =
        userRole &&
        ['ADMIN', 'SUPER_ADMIN', 'OWNER', 'OPERATION'].includes(userRole);
      const booking = await tx.booking.findFirst({
        where: isAdmin ? { id } : { id, userId },
      });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.status === BookingStatus.CANCELLED)
        throw new BadRequestException('Booking already cancelled');
      if (
        booking.status === BookingStatus.BOARDED ||
        booking.status === BookingStatus.COMPLETED
      )
        throw new BadRequestException(
          'Cannot cancel a boarded or completed booking',
        );

      const result = await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.CANCELLED },
        include: {
          user: true,
          trip: {
            include: {
              route: true,
            },
          },
        },
      });

      if (booking.status === BookingStatus.CONFIRMED && booking.promoCodeId) {
        await tx.promoCode.update({
          where: { id: booking.promoCodeId },
          data: { usageCount: { decrement: 1 } },
        });
      }

      return result;
    });

    // Update bookedSeats of the trip dynamically (self-healing)
    await this.cleanupExpiredBookings(updated.tripId.toString());

    // Send cancellation notification email/SMS/WhatsApp asynchronously
    try {
      const u = updated.user;
      const t = updated.trip;
      const r = t?.route;
      if (u && t && r) {
        const seatNo = Array.isArray(updated.seatNumbers)
          ? updated.seatNumbers.join(', ')
          : typeof updated.seatNumbers === 'string'
            ? updated.seatNumbers
            : typeof updated.seatNumbers === 'number'
              ? String(updated.seatNumbers)
              : '';
        const initiator =
          userRole &&
          ['ADMIN', 'SUPER_ADMIN', 'OWNER', 'OPERATION'].includes(userRole)
            ? 'SYSTEM'
            : 'PASSENGER';

        this.notificationsService
          .sendCancellationNotification(
            u.phone || '',
            u.name || 'Valued Passenger',
            {
              routeName: r.name || 'D-Ride Trip',
              departureTime: t.departureTime.toISOString(),
              seatNumber: seatNo,
              price: updated.amountEGP,
            },
            u.email || '',
            initiator,
          )
          .catch((err) =>
            console.error(
              'Failed to send cancellation notification asynchronously:',
              err,
            ),
          );
      }
    } catch (err) {
      console.error('Failed to initiate cancellation notification:', err);
    }

    return this.mapBooking(updated);
  }

  async refundBooking(
    bookingId: string,
    action?: 'FULL' | 'HALF' | 'REJECT',
  ): Promise<any> {
    // 1. Fetch booking with trip, route, and user details first to compute policy
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        trip: {
          include: {
            route: true,
          },
        },
        user: true,
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.status !== BookingStatus.CANCELLED) {
      throw new BadRequestException('Only cancelled bookings can be refunded');
    }

    if (
      booking.paymentStatus === 'REFUNDED' ||
      booking.paymentStatus === 'FAILED'
    ) {
      throw new BadRequestException(
        'Refund request has already been processed',
      );
    }

    // 2. Calculate policy recommendation based on time difference between cancellation (updatedAt) and trip departure
    const cancellationTime = new Date(booking.updatedAt);
    const departureTime = booking.trip
      ? new Date(booking.trip.departureTime)
      : null;

    let calculatedAction: 'FULL' | 'HALF' | 'REJECT' = 'REJECT';
    let calculatedReason =
      'Cancelled less than 24 hours before departure (rejected)';
    let calculatedPercentage = 0;

    if (departureTime) {
      const diffMs = departureTime.getTime() - cancellationTime.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours >= 48) {
        calculatedAction = 'FULL';
        calculatedReason = 'Cancelled 48+ hours before departure (100% refund)';
        calculatedPercentage = 100;
      } else if (diffHours >= 24) {
        calculatedAction = 'HALF';
        calculatedReason =
          'Cancelled 24-48 hours before departure (50% refund)';
        calculatedPercentage = 50;
      } else {
        calculatedAction = 'REJECT';
        calculatedReason =
          'Cancelled less than 24 hours before departure (no refund)';
        calculatedPercentage = 0;
      }
    }

    // Use explicit admin override action or fallback to the calculated policy action
    const finalAction = action || calculatedAction;
    let refundPercentage = calculatedPercentage;
    let reason = calculatedReason;

    if (action) {
      if (action === 'FULL') {
        refundPercentage = 100;
        reason = 'Approved for 100% full refund (admin override)';
      } else if (action === 'HALF') {
        refundPercentage = 50;
        reason = 'Approved for 50% partial refund (admin override)';
      } else {
        refundPercentage = 0;
        reason = 'Refund request rejected (admin override)';
      }
    }

    const refundAmount = (booking.amountEGP * refundPercentage) / 100;

    const result = await this.prisma.$transaction(async (tx) => {
      // Find the original successful transaction to log correct payment method
      const originalTx = await tx.transaction.findFirst({
        where: {
          bookingId: bookingId,
          status: 'SUCCESS',
        },
      });

      // Update booking status
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status:
            finalAction === 'REJECT'
              ? BookingStatus.CANCELLED
              : BookingStatus.REFUNDED,
          paymentStatus: finalAction === 'REJECT' ? 'FAILED' : 'REFUNDED',
        },
      });

      // Create a refund/reject transaction record
      await tx.transaction.create({
        data: {
          bookingId: bookingId,
          userId: booking.userId,
          paymobOrderId: crypto.randomInt(100000000, 999999999),
          amountEGP: -refundAmount,
          status: finalAction === 'REJECT' ? 'FAILED' : 'REFUNDED',
          paymentMethod: originalTx?.paymentMethod || 'CARD',
        },
      });

      return updated;
    });

    // 3. Dispatch notifications to the passenger asynchronously after transaction commits successfully
    try {
      const u = booking.user;
      const t = booking.trip;
      const r = t?.route;
      if (u) {
        await this.notificationsService.sendRefundNotification(
          u.phone || '',
          u.name || 'Valued Passenger',
          {
            routeName: r?.name || 'D-Ride Trip',
            departureTime: t?.departureTime
              ? t.departureTime.toISOString()
              : new Date().toISOString(),
            originalAmount: booking.amountEGP,
            refundAmount: refundAmount,
            percentage: refundPercentage,
            reason: reason,
          },
          u.email || '',
        );
      }
    } catch (err) {
      console.error('Failed to send refund notification:', err);
    }

    return this.mapBooking(result);
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
        status: {
          not: 'CANCELLED',
        },
      },
      include: {
        user: true,
        transactions: true,
      },
    });
    return bookings.map((b) => this.mapBooking(b));
  }

  async checkInPassenger(bookingId: string): Promise<any> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.status !== BookingStatus.CONFIRMED) {
      if (booking.status === BookingStatus.CANCELLED) {
        throw new BadRequestException('Booking has been cancelled');
      }
      if (booking.status === BookingStatus.BOARDED) {
        throw new BadRequestException('Passenger already boarded');
      }
      throw new BadRequestException(
        `Cannot check in: booking status is ${booking.status}, expected CONFIRMED`,
      );
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

  async verifyUserTripAccess(userId: string, tripId: string): Promise<void> {
    const booking = await this.prisma.booking.findFirst({
      where: {
        userId,
        tripId,
        status: {
          in: [BookingStatus.CONFIRMED, BookingStatus.BOARDED],
        },
      },
    });
    if (!booking) {
      throw new ForbiddenException('No active booking found for this trip');
    }
  }

  async trackByCode(code: string, userId?: string): Promise<any> {
    let booking = null;
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        code,
      );

    if (isUuid) {
      booking = await this.prisma.booking.findUnique({
        where: { id: code },
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
    } else {
      const bookings = await this.prisma.booking.findMany({
        where: {
          id: {
            endsWith: code.toLowerCase(),
            mode: 'insensitive',
          },
        },
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
      if (bookings.length > 0) {
        booking = bookings[0];
      }
    }

    if (!booking) {
      throw new NotFoundException('Booking not found with this ticket code');
    }

    // If userId provided, verify ownership (unless admin/driver)
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      const isAdmin =
        user &&
        ['ADMIN', 'SUPER_ADMIN', 'OWNER', 'OPERATION'].includes(user.role);
      const isDriver = user && user.role === 'DRIVER';

      if (!isAdmin && !isDriver) {
        // Passenger can only track their own bookings
        if (booking.userId !== userId) {
          throw new ForbiddenException('Not authorized to track this booking');
        }
      }
    }

    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.REFUNDED
    ) {
      throw new BadRequestException('This ticket booking has been cancelled');
    }

    let liveLocation = null;
    if (booking.trip?.vehicleId) {
      try {
        liveLocation = await this.prisma.liveVehicleLocation.findUnique({
          where: { vehicleId: booking.trip.vehicleId },
        });
      } catch (err) {
        // ignore
      }
    }

    const mapped = this.mapBooking(booking);
    return {
      booking: mapped,
      liveLocation: liveLocation
        ? { ...liveLocation, _id: liveLocation.id }
        : null,
    };
  }

  async applyPromoCode(
    bookingId: string,
    userId: string,
    code: string | null,
  ): Promise<any> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { trip: { include: { route: true } } },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.userId !== userId) {
      throw new BadRequestException('Unauthorized to modify this booking');
    }

    if (
      booking.status !== BookingStatus.PENDING_PAYMENT &&
      booking.status !== BookingStatus.PENDING
    ) {
      throw new BadRequestException(
        'Can only apply promo codes to pending bookings',
      );
    }

    const currentTrip = booking.trip;
    if (!currentTrip) {
      throw new NotFoundException('Trip not found');
    }

    // Recalculate original segment price
    const routeCheckpoints = (currentTrip.route?.checkpoints as any[]) || [];
    const pickupCp = routeCheckpoints.find(
      (cp) =>
        booking.pickupStopId &&
        (cp.id === booking.pickupStopId || cp.name === booking.pickupStopId),
    );
    const dropoffCp = routeCheckpoints.find(
      (cp) =>
        booking.dropoffStopId &&
        (cp.id === booking.dropoffStopId || cp.name === booking.dropoffStopId),
    );

    let segmentPrice = currentTrip.priceEGP || 0;
    let customSurcharge: number | undefined;
    if (pickupCp && dropoffCp) {
      if (pickupCp.prices && pickupCp.prices[dropoffCp.name] !== undefined) {
        segmentPrice = Number(pickupCp.prices[dropoffCp.name]);
      } else {
        const pickupPrice = Number(pickupCp.priceFromStartEGP || 0);
        const dropoffPrice = Number(
          dropoffCp.priceFromStartEGP || currentTrip.priceEGP || 0,
        );
        segmentPrice = dropoffPrice - pickupPrice;
      }
      if (
        pickupCp.premiumSurcharges &&
        pickupCp.premiumSurcharges[dropoffCp.name] !== undefined
      ) {
        customSurcharge = Number(pickupCp.premiumSurcharges[dropoffCp.name]);
      }
    }

    const bookingSeatsList = Array.isArray(booking.seatNumbers)
      ? (booking.seatNumbers as number[])
      : [1];
    const baseAmount = this.calculateBasePrice(
      currentTrip,
      segmentPrice,
      bookingSeatsList,
      customSurcharge,
    );

    return this.prisma.$transaction(async (tx) => {
      if (!code || code.trim() === '') {
        // Clear promo code
        const updated = await tx.booking.update({
          where: { id: bookingId },
          data: {
            discountEGP: 0,
            promoCodeId: null,
            amountEGP: baseAmount,
          },
          include: {
            trip: {
              include: {
                route: true,
                vehicle: true,
                driver: true,
              },
            },
            user: true,
            transactions: true,
          },
        });

        await tx.transaction.updateMany({
          where: {
            bookingId,
            status: PaymentStatus.PENDING,
          },
          data: {
            amountEGP: baseAmount,
          },
        });

        return this.mapBooking(updated);
      }

      // Validate Promo Code
      const promoCodeNormalized = code.trim().toUpperCase();
      const promo = await tx.promoCode.findUnique({
        where: { code: promoCodeNormalized },
      });

      if (!promo) {
        throw new BadRequestException('Invalid promo code');
      }

      if (!promo.isActive) {
        throw new BadRequestException('This promo code is inactive');
      }

      if (promo.expiryDate && new Date() > new Date(promo.expiryDate)) {
        throw new BadRequestException('This promo code has expired');
      }

      if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
        throw new BadRequestException(
          'This promo code has reached its usage limit',
        );
      }

      if (baseAmount < promo.minBookingAmountEGP) {
        throw new BadRequestException(
          `Booking total (${baseAmount} EGP) must be at least ${promo.minBookingAmountEGP} EGP to use this promo code`,
        );
      }

      let discount = 0;
      if (promo.discountType === 'FIXED') {
        discount = promo.discountValue;
      } else if (promo.discountType === 'PERCENTAGE') {
        discount = baseAmount * (promo.discountValue / 100);
        if (promo.maxDiscountEGP !== null) {
          discount = Math.min(discount, promo.maxDiscountEGP);
        }
      }

      discount = Math.min(discount, baseAmount);
      const finalAmount = baseAmount - discount;

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          discountEGP: discount,
          promoCodeId: promo.id,
          amountEGP: finalAmount,
        },
        include: {
          trip: {
            include: {
              route: true,
            },
          },
          user: true,
          transactions: true,
        },
      });

      await tx.transaction.updateMany({
        where: {
          bookingId,
          status: PaymentStatus.PENDING,
        },
        data: {
          amountEGP: finalAmount,
        },
      });

      return this.mapBooking(updated);
    });
  }
}
