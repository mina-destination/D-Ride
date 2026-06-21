import { Test, TestingModule } from '@nestjs/testing';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

describe('BookingsController', () => {
  let controller: BookingsController;
  let service: BookingsService;

  const mockBookingsService = {
    findAll: jest.fn(),
    findMyBookings: jest.fn(),
    create: jest.fn(),
    payWithWallet: jest.fn(),
    cancel: jest.fn(),
    applyPromoCode: jest.fn(),
    findOccupiedSeats: jest.fn(),
    findTripManifest: jest.fn(),
    checkInPassenger: jest.fn(),
    verifyTicket: jest.fn(),
    refundBooking: jest.fn(),
    trackByCode: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        {
          provide: BookingsService,
          useValue: mockBookingsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BookingsController>(BookingsController);
    service = module.get<BookingsService>(BookingsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all bookings for ADMIN', async () => {
      const mockBookings = [{ id: '1', userId: 'user-1' }];
      mockBookingsService.findAll.mockResolvedValue(mockBookings);

      const res = await controller.findAll();
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockBookings);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findMyBookings', () => {
    it('should return user specific bookings', async () => {
      const req = { user: { sub: 'user-1' } };
      const mockBookings = [{ id: '1', userId: 'user-1' }];
      mockBookingsService.findMyBookings.mockResolvedValue(mockBookings);

      const res = await controller.findMyBookings(req);
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockBookings);
      expect(service.findMyBookings).toHaveBeenCalledWith('user-1');
    });
  });

  describe('create', () => {
    it('should create a booking with user id from token when passenger', async () => {
      const req = { user: { sub: 'user-1', role: 'PASSENGER' } };
      const createBookingDto: CreateBookingDto = {
        tripId: 'trip-1',
        pickupCheckpointId: 'cp-1',
        dropoffCheckpointId: 'cp-2',
        seatNumber: 1,
      };
      const mockBooking = { id: 'b-1', ...createBookingDto, userId: 'user-1' };
      mockBookingsService.create.mockResolvedValue(mockBooking);

      const res = await controller.create(req, createBookingDto);
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockBooking);
      expect(service.create).toHaveBeenCalledWith({
        ...createBookingDto,
        userId: 'user-1',
      });
    });

    it('should allow admin to create a booking on behalf of another user', async () => {
      const req = { user: { sub: 'admin-1', role: 'ADMIN' } };
      const createBookingDto: CreateBookingDto = {
        tripId: 'trip-1',
        pickupCheckpointId: 'cp-1',
        dropoffCheckpointId: 'cp-2',
        seatNumber: 1,
        userId: 'other-user-id',
      };
      const mockBooking = { id: 'b-1', ...createBookingDto };
      mockBookingsService.create.mockResolvedValue(mockBooking);

      const res = await controller.create(req, createBookingDto);
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockBooking);
      expect(service.create).toHaveBeenCalledWith(createBookingDto);
    });
  });

  describe('payWithWallet', () => {
    it('should pay with wallet balance', async () => {
      const req = { user: { sub: 'user-1' } };
      const mockBooking = { id: 'b-1', status: 'PAID' };
      mockBookingsService.payWithWallet.mockResolvedValue(mockBooking);

      const res = await controller.payWithWallet(req, 'b-1');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockBooking);
      expect(service.payWithWallet).toHaveBeenCalledWith('b-1', 'user-1');
    });
  });

  describe('cancel', () => {
    it('should cancel booking', async () => {
      const req = { user: { sub: 'user-1', role: 'PASSENGER' } };
      const mockBooking = { id: 'b-1', status: 'CANCELLED' };
      mockBookingsService.cancel.mockResolvedValue(mockBooking);

      const res = await controller.cancel(req, 'b-1');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockBooking);
      expect(service.cancel).toHaveBeenCalledWith('b-1', 'user-1', 'PASSENGER');
    });
  });

  describe('applyPromo', () => {
    it('should apply promo code', async () => {
      const req = { user: { sub: 'user-1' } };
      const mockBooking = { id: 'b-1', cost: 80, discount: 20 };
      mockBookingsService.applyPromoCode.mockResolvedValue(mockBooking);

      const res = await controller.applyPromo(req, 'b-1', 'DISCOUNT20');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockBooking);
      expect(service.applyPromoCode).toHaveBeenCalledWith(
        'b-1',
        'user-1',
        'DISCOUNT20',
      );
    });
  });

  describe('getOccupiedSeats', () => {
    it('should return list of occupied seats', async () => {
      const mockSeats = [1, 2, 5];
      mockBookingsService.findOccupiedSeats.mockResolvedValue(mockSeats);

      const res = await controller.getOccupiedSeats(
        'trip-1',
        'pickup-cp',
        'dropoff-cp',
      );
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockSeats);
      expect(service.findOccupiedSeats).toHaveBeenCalledWith(
        'trip-1',
        'pickup-cp',
        'dropoff-cp',
      );
    });
  });

  describe('getTripManifest', () => {
    it('should return trip manifest for driver', async () => {
      const mockManifest = { tripId: 'trip-1', manifest: [] };
      mockBookingsService.findTripManifest.mockResolvedValue(mockManifest);

      const res = await controller.getTripManifest('trip-1');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockManifest);
      expect(service.findTripManifest).toHaveBeenCalledWith('trip-1');
    });
  });

  describe('checkIn', () => {
    it('should check in the passenger', async () => {
      const mockBooking = { id: 'b-1', checkInTime: new Date() };
      mockBookingsService.checkInPassenger.mockResolvedValue(mockBooking);

      const res = await controller.checkIn('b-1');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockBooking);
      expect(service.checkInPassenger).toHaveBeenCalledWith('b-1');
    });
  });

  describe('verifyTicket', () => {
    it('should verify ticket with code token', async () => {
      const mockBooking = { id: 'b-1', status: 'VERIFIED' };
      mockBookingsService.verifyTicket.mockResolvedValue(mockBooking);

      const res = await controller.verifyTicket('b-1', 'verification-token');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockBooking);
      expect(service.verifyTicket).toHaveBeenCalledWith(
        'b-1',
        'verification-token',
      );
    });
  });

  describe('refundBooking', () => {
    it('should refund booking with action', async () => {
      const mockBooking = { id: 'b-1', status: 'REFUNDED' };
      mockBookingsService.refundBooking.mockResolvedValue(mockBooking);

      const res = await controller.refundBooking('b-1', 'FULL');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockBooking);
      expect(service.refundBooking).toHaveBeenCalledWith('b-1', 'FULL');
    });
  });

  describe('trackByCode', () => {
    it('should return tracking details for a code', async () => {
      const req = { user: { sub: 'user-1', role: 'PASSENGER' } };
      const mockTracking = { id: 'b-1', code: 'CODE123' };
      mockBookingsService.trackByCode.mockResolvedValue(mockTracking);

      const res = await controller.trackByCode(req, 'CODE123');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockTracking);
      expect(service.trackByCode).toHaveBeenCalledWith('CODE123', 'user-1');
    });

    it('should return tracking details without user ownership check for ADMIN', async () => {
      const req = { user: { sub: 'admin-1', role: 'ADMIN' } };
      const mockTracking = { id: 'b-1', code: 'CODE123' };
      mockBookingsService.trackByCode.mockResolvedValue(mockTracking);

      const res = await controller.trackByCode(req, 'CODE123');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockTracking);
      expect(service.trackByCode).toHaveBeenCalledWith('CODE123', undefined);
    });
  });

  describe('findById', () => {
    it('should return a booking by id', async () => {
      const req = { user: { sub: 'user-1' } };
      const mockBooking = { id: 'b-1', userId: 'user-1' };
      mockBookingsService.findOne.mockResolvedValue(mockBooking);

      const res = await controller.findById(req, 'b-1');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockBooking);
      expect(service.findOne).toHaveBeenCalledWith('b-1', 'user-1');
    });
  });
});
