import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { BookingEntity, BookingDocument } from '../schemas/booking.schema';
import { TripsService } from '../trips/trips.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(BookingEntity.name)
    private bookingModel: Model<BookingDocument>,
    private tripsService: TripsService,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
  ) {}

  async findAll(): Promise<BookingEntity[]> {
    return this.bookingModel
      .find()
      .populate({
        path: 'tripId',
        populate: { path: 'routeId' },
      })
      .populate('userId')
      .exec();
  }

  async findMyBookings(userId: string): Promise<BookingEntity[]> {
    return this.bookingModel
      .find({ userId })
      .populate({
        path: 'tripId',
        populate: { path: 'routeId' },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async create(data: Partial<BookingEntity>): Promise<BookingEntity> {
    // 1. Fetch trip to check seats
    const tripIdStr = data.tripId ? data.tripId.toString() : '';
    const trip = (await this.tripsService.findById(tripIdStr)) as any;
    if (!trip) throw new NotFoundException('Trip not found');

    const requestedSeats = data.seatNumbers?.length || 1;
    if (trip.bookedSeats + requestedSeats > trip.availableSeats) {
      throw new BadRequestException('Not enough available seats');
    }

    // 2. Increment booked seats on trip (optimistic locking)
    await this.tripsService.incrementBookedSeats(
      trip._id.toString(),
      requestedSeats,
    );

    // 3. Create booking as PENDING_PAYMENT
    data.amountEGP = (trip.priceEGP || 0) * requestedSeats;
    data.status = 'PENDING_PAYMENT';
    data.qrVerificationToken = crypto.randomBytes(16).toString('hex');

    const newBooking = new this.bookingModel(data);
    return newBooking.save();
  }

  async updateStatus(id: string, status: string): Promise<BookingEntity> {
    const booking = await this.bookingModel.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');

    booking.status = status;
    const saved = await booking.save();

    if (status === 'CONFIRMED') {
      try {
        const populated = await this.bookingModel
          .findById(id)
          .populate({ path: 'tripId', populate: { path: 'routeId' } })
          .populate('userId');

        if (populated) {
          const u = populated.userId as any;
          const t = populated.tripId as any;
          const r = t?.routeId;
          const seatsStr = populated.seatNumbers?.join(', ') || 'N/A';

          await this.notificationsService.sendBookingConfirmation(
            u?.phone || '',
            u?.name || 'Valued Passenger',
            {
              routeName: r?.name || 'D-Ride Minibus Trip',
              departureTime: t?.departureTime || new Date().toISOString(),
              seatNumber: seatsStr,
              price: populated.amountEGP || 0,
            },
          );
        }
      } catch (err) {
        console.error('Failed to dispatch notification:', err);
      }
    }

    return saved;
  }

  async cancel(id: string, userId: string): Promise<BookingEntity> {
    const booking = await this.bookingModel.findOne({ _id: id, userId }).exec();
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status === 'CANCELLED')
      throw new BadRequestException('Booking already cancelled');

    booking.status = 'CANCELLED';
    await booking.save();

    // Decrement seats (we pass negative count)
    const seatsCount = booking.seatNumbers?.length || 1;
    await this.tripsService.incrementBookedSeats(
      booking.tripId.toString(),
      -seatsCount,
    );

    return booking;
  }

  async findOccupiedSeats(tripId: string): Promise<number[]> {
    const bookings = await this.bookingModel
      .find({
        tripId,
        status: { $ne: 'CANCELLED' },
      })
      .select('seatNumbers')
      .exec();

    const occupied: number[] = [];
    bookings.forEach((b) => {
      if (b.seatNumbers && Array.isArray(b.seatNumbers)) {
        occupied.push(...b.seatNumbers);
      }
    });
    return occupied;
  }

  async findTripManifest(tripId: string): Promise<BookingEntity[]> {
    return this.bookingModel
      .find({
        tripId,
        status: { $ne: 'CANCELLED' },
      })
      .populate('userId')
      .exec();
  }

  async checkInPassenger(bookingId: string): Promise<BookingEntity> {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.status !== 'CONFIRMED' && booking.status !== 'PENDING') {
      // Allow pending too if needed, but confirmed is standard. Let's allow CONFIRMED or PENDING_PAYMENT / PENDING if we want to be flexible.
      // But confirmed is the safest default. Let's throw only if cancelled or already completed.
      if (booking.status === 'CANCELLED') {
        throw new BadRequestException('Booking has been cancelled');
      }
    }

    booking.status = 'BOARDED';
    return booking.save();
  }

  async verifyTicket(id: string, token: string): Promise<BookingEntity> {
    const booking = await this.bookingModel.findById(id);
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.qrVerificationToken !== token) {
      throw new BadRequestException('Invalid ticket verification token');
    }

    if (booking.status === 'BOARDED') {
      return booking;
    }

    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Booking has been cancelled');
    }

    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException(`Booking status is ${booking.status}, expected CONFIRMED`);
    }

    booking.status = 'BOARDED';
    return booking.save();
  }
}
