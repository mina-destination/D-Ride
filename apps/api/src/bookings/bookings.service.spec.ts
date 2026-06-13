import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { TripsService } from '../trips/trips.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { BookingStatus, PaymentStatus } from '@prisma/client';

jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue(Buffer.from('test-bytes-16bytes')),
  randomInt: jest.fn().mockReturnValue(123456789),
}));

describe('BookingsService', () => {
  let service: BookingsService;
  let mockPrismaService: any;
  let mockTripsService: any;
  let mockConfigService: any;
  let mockNotificationsService: any;

  const mockTrip = {
    id: 'trip-1',
    routeId: 'route-1',
    priceEGP: 100,
    premiumSeatSurcharge: 0,
    availableSeats: 14,
    bookedSeats: 0,
    lockedSeats: [14],
    departureTime: new Date(Date.now() + 86400000),
    vehicle: { id: 'vehicle-1', capacity: 14 },
    route: {
      id: 'route-1',
      name: 'Test Route',
      checkpoints: [
        {
          id: 'cp-1',
          name: 'Start',
          order: 1,
          minutesFromStart: 0,
          priceFromStartEGP: 0,
          purpose: 'PICKUP',
        },
        {
          id: 'cp-2',
          name: 'Middle',
          order: 2,
          minutesFromStart: 15,
          priceFromStartEGP: 50,
          purpose: 'PICKUP',
        },
        {
          id: 'cp-3',
          name: 'End',
          order: 3,
          minutesFromStart: 30,
          priceFromStartEGP: 100,
          purpose: 'DROP_OFF',
        },
      ],
    },
  };

  const mockBooking = {
    id: 'booking-1',
    userId: 'user-1',
    tripId: 'trip-1',
    seatNumbers: [1],
    status: BookingStatus.PENDING_PAYMENT,
    paymentStatus: PaymentStatus.PENDING,
    amountEGP: 100,
    discountEGP: 0,
    promoCodeId: null,
    qrVerificationToken: 'test-token',
    boardingNumber: 1,
    pickupStopId: 'cp-1',
    dropoffStopId: 'cp-3',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    phone: '+201001234567',
    role: 'PASSENGER',
  };

  function createTxMock() {
    return {
      trip: {
        findUnique: jest.fn().mockResolvedValue(mockTrip),
        update: jest.fn().mockResolvedValue(mockTrip),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(mockBooking),
        update: jest.fn().mockResolvedValue(mockBooking),
        updateMany: jest.fn(),
      },
      promoCode: { findUnique: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn(), update: jest.fn() },
      transaction: {
        create: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
    };
  }

  beforeEach(async () => {
    mockPrismaService = {
      booking: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      trip: { findUnique: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
      promoCode: { findUnique: jest.fn(), update: jest.fn() },
      transaction: {
        create: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      liveVehicleLocation: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };

    mockTripsService = {};
    mockConfigService = { get: jest.fn().mockReturnValue('test-value') };
    mockNotificationsService = {
      sendBookingConfirmation: jest.fn().mockResolvedValue(true),
      sendCancellationNotification: jest.fn().mockResolvedValue(true),
      sendRefundNotification: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TripsService, useValue: mockTripsService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all bookings', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([mockBooking]);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });
  });

  describe('findMyBookings', () => {
    it('should return bookings for a specific user', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([mockBooking]);
      const result = await service.findMyBookings('user-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('should throw NotFoundException if trip does not exist', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        return cb(createTxMock());
      });

      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        return cb({
          ...createTxMock(),
          trip: { findUnique: jest.fn().mockResolvedValue(null) },
        });
      });

      await expect(
        service.create({
          userId: 'user-1',
          tripId: 'nonexistent-trip',
          seatNumbers: [1],
          pickupCheckpointId: 'cp-1',
          dropoffCheckpointId: 'cp-3',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should auto-cancel duplicate pending booking and create new booking successfully', async () => {
      let updatedBookingId = '';
      let updatedStatus = '';
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        const tx = createTxMock();
        tx.booking.findFirst = jest.fn().mockResolvedValue(mockBooking);
        tx.booking.update = jest.fn().mockImplementation((args) => {
          updatedBookingId = args.where.id;
          updatedStatus = args.data.status;
          return Promise.resolve({
            ...mockBooking,
            status: BookingStatus.CANCELLED,
          });
        });
        tx.booking.create = jest.fn().mockResolvedValue(mockBooking);
        return cb(tx);
      });

      mockPrismaService.booking.findUnique.mockResolvedValueOnce({
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
        trip: mockTrip,
        user: mockUser,
      });

      const result = await service.create({
        userId: 'user-1',
        tripId: 'trip-1',
        seatNumbers: [1],
        pickupCheckpointId: 'cp-1',
        dropoffCheckpointId: 'cp-3',
      });

      expect(result).toBeDefined();
      expect(updatedBookingId).toBe('booking-1');
      expect(updatedStatus).toBe(BookingStatus.CANCELLED);
    });

    it('should throw BadRequestException for invalid seat numbers', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        const tx = createTxMock();
        tx.booking.findFirst = jest.fn().mockResolvedValue(null);
        return cb(tx);
      });

      await expect(
        service.create({
          userId: 'user-1',
          tripId: 'trip-1',
          seatNumbers: [99],
          pickupCheckpointId: 'cp-1',
          dropoffCheckpointId: 'cp-3',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a booking successfully', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        const tx = createTxMock();
        tx.booking.findFirst = jest.fn().mockResolvedValue(null);
        tx.booking.create = jest.fn().mockResolvedValue(mockBooking);
        return cb(tx);
      });

      mockPrismaService.booking.findUnique.mockResolvedValueOnce({
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
        trip: mockTrip,
        user: mockUser,
      });

      const result = await service.create({
        userId: 'user-1',
        tripId: 'trip-1',
        seatNumbers: [1],
        pickupCheckpointId: 'cp-1',
        dropoffCheckpointId: 'cp-3',
      });

      expect(result).toBeDefined();
    });
  });

  describe('cancel', () => {
    it('should throw NotFoundException if booking does not exist', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        return cb({
          booking: { findFirst: jest.fn().mockResolvedValue(null) },
        });
      });

      await expect(service.cancel('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should cancel a booking successfully', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          booking: {
            findFirst: jest.fn().mockResolvedValue(mockBooking),
            update: jest.fn().mockResolvedValue({
              ...mockBooking,
              status: BookingStatus.CANCELLED,
              user: mockUser,
              trip: mockTrip,
            }),
          },
          promoCode: { update: jest.fn() },
        };
        return cb(tx);
      });

      mockPrismaService.booking.findMany.mockResolvedValue([]);

      const result = await service.cancel('booking-1', 'user-1');
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if already cancelled', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        return cb({
          booking: {
            findFirst: jest.fn().mockResolvedValue({
              ...mockBooking,
              status: BookingStatus.CANCELLED,
            }),
          },
        });
      });

      await expect(service.cancel('booking-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findOccupiedSeats', () => {
    it('should return occupied seat numbers', async () => {
      mockPrismaService.booking.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { seatNumbers: [1, 2], pickupStopId: 'cp-1', dropoffStopId: 'cp-3' },
        ]);
      mockPrismaService.trip.findUnique.mockResolvedValue(mockTrip);
      mockPrismaService.trip.update.mockResolvedValue(mockTrip);

      const result = await service.findOccupiedSeats('trip-1');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('checkInPassenger', () => {
    it('should throw NotFoundException if booking not found', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(null);
      await expect(service.checkInPassenger('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should check in passenger successfully', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
      });
      mockPrismaService.booking.update.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.BOARDED,
      });

      const result = await service.checkInPassenger('booking-1');
      expect(result).toBeDefined();
    });
  });

  describe('verifyTicket', () => {
    it('should throw NotFoundException if booking not found', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(null);
      await expect(
        service.verifyTicket('nonexistent', 'token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);
      await expect(
        service.verifyTicket('booking-1', 'wrong-token'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should verify ticket and board passenger', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
        qrVerificationToken: 'correct-token',
      });
      mockPrismaService.booking.update.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.BOARDED,
      });

      const result = await service.verifyTicket('booking-1', 'correct-token');
      expect(result).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if booking not found', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(null);
      await expect(service.findOne('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return booking for the user', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);
      const result = await service.findOne('booking-1', 'user-1');
      expect(result).toBeDefined();
    });
  });

  describe('verifyUserTripAccess', () => {
    it('should throw ForbiddenException if no active booking', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(null);
      await expect(
        service.verifyUserTripAccess('user-1', 'trip-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should pass if active booking exists', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);
      await expect(
        service.verifyUserTripAccess('user-1', 'trip-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('trackByCode', () => {
    it('should throw NotFoundException if booking not found', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(null);
      await expect(service.trackByCode('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return booking with live location', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        trip: { ...mockTrip, vehicleId: 'vehicle-1' },
      });
      mockPrismaService.liveVehicleLocation.findUnique.mockResolvedValue({
        id: 'loc-1',
        vehicleId: 'vehicle-1',
        location: { type: 'Point', coordinates: [31.23, 30.04] },
      });

      const result = await service.trackByCode('booking-1');
      expect(result.booking).toBeDefined();
      expect(result.liveLocation).toBeDefined();
    });
  });

  describe('applyPromoCode', () => {
    it('should throw NotFoundException if booking not found', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(null);
      await expect(
        service.applyPromoCode('nonexistent', 'user-1', 'PROMO'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if not booking owner', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);
      await expect(
        service.applyPromoCode('booking-1', 'different-user', 'PROMO'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should apply promo code to pending booking', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.PENDING_PAYMENT,
        trip: mockTrip,
      });

      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          booking: {
            update: jest.fn().mockResolvedValue({
              ...mockBooking,
              discountEGP: 20,
              amountEGP: 80,
              promoCodeId: 'promo-1',
              trip: mockTrip,
              user: mockUser,
              transactions: [],
            }),
          },
          promoCode: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'promo-1',
              code: 'PROMO20',
              isActive: true,
              discountType: 'FIXED',
              discountValue: 20,
              minBookingAmountEGP: 0,
              usageLimit: null,
              usageCount: 0,
            }),
          },
          transaction: { updateMany: jest.fn() },
        };
        return cb(tx);
      });

      const result = await service.applyPromoCode(
        'booking-1',
        'user-1',
        'PROMO20',
      );
      expect(result).toBeDefined();
    });
  });

  describe('refundBooking', () => {
    it('should throw NotFoundException if booking not found', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(null);
      await expect(service.refundBooking('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if booking is not cancelled', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);
      await expect(service.refundBooking('booking-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should process full refund for cancelled booking 48+ hrs before departure', async () => {
      const cancelledBooking = {
        ...mockBooking,
        status: BookingStatus.CANCELLED,
        paymentStatus: 'PENDING',
        updatedAt: new Date(Date.now() - 50 * 60 * 60 * 1000),
        trip: {
          ...mockTrip,
          departureTime: new Date(Date.now() + 1000 * 60 * 60),
        },
        user: mockUser,
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(cancelledBooking);
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          transaction: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
          booking: { update: jest.fn().mockResolvedValue(cancelledBooking) },
        };
        return cb(tx);
      });

      const result = await service.refundBooking('booking-1');
      expect(result).toBeDefined();
    });
  });
});
