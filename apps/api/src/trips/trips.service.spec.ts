import { Test, TestingModule } from '@nestjs/testing';
import { TripsService } from './trips.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VehiclesGateway } from '../vehicles/vehicles.gateway';
import { ConfigService } from '@nestjs/config';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

describe('TripsService', () => {
  let service: TripsService;
  let mockPrismaService: any;
  let mockNotificationsService: any;

  const mockTrip = {
    id: 'trip-1',
    routeId: 'route-1',
    vehicleId: 'vehicle-1',
    driverId: 'driver-1',
    priceEGP: 100,
    premiumSeatSurcharge: 0,
    availableSeats: 14,
    bookedSeats: 0,
    lockedSeats: [14],
    status: 'SCHEDULED',
    departureTime: new Date(Date.now() + 86400000),
    arrivalTime: null,
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
        },
        {
          id: 'cp-2',
          name: 'End',
          order: 2,
          minutesFromStart: 30,
          priceFromStartEGP: 100,
        },
      ],
    },
    vehicle: {
      id: 'vehicle-1',
      model: 'Toyota::Hiace',
      plateNumber: 'ABC123',
      capacity: 14,
      isActive: true,
    },
    driver: {
      id: 'driver-1',
      name: 'Test Driver',
      email: 'driver@example.com',
      role: 'DRIVER',
    },
  };

  const mockDriver = {
    id: 'driver-1',
    name: 'Test Driver',
    role: 'DRIVER',
  };

  const mockAdmin = {
    id: 'admin-1',
    name: 'Admin',
    role: 'ADMIN',
  };

  let mockVehiclesGateway: any;

  beforeEach(async () => {
    mockPrismaService = {
      trip: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      booking: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      route: {
        findUnique: jest.fn(),
      },
      vehicle: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    mockNotificationsService = {
      sendCancellationNotification: jest.fn().mockResolvedValue(true),
    };

    mockVehiclesGateway = {
      getArrivedCheckpoints: jest.fn().mockResolvedValue([]),
      setArrivedCheckpoints: jest.fn().mockResolvedValue(undefined),
      emitTripStatusUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: VehiclesGateway,
          useValue: mockVehiclesGateway,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key) => {
              if (key === 'defaults.vehicleCapacity') return 14;
              if (key === 'defaults.countryCode') return '+20';
              if (key === 'defaults.lockedSeats') return [14];
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TripsService>(TripsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all trips', async () => {
      mockPrismaService.trip.findMany.mockResolvedValue([mockTrip]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException if trip not found', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      mockPrismaService.trip.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return trip by id', async () => {
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      mockPrismaService.trip.findUnique.mockResolvedValue(mockTrip);

      const result = await service.findById('trip-1');

      expect(result).toBeDefined();
    });
  });

  describe('searchTrips', () => {
    it('should return filtered trips', async () => {
      mockPrismaService.trip.findMany.mockResolvedValue([mockTrip]);
      mockPrismaService.booking.findMany.mockResolvedValue([]);

      const result = await service.searchTrips(
        'route-1',
        undefined,
        'Start',
        'End',
      );

      expect(result).toHaveLength(1);
    });

    it('should return empty array if no trips match', async () => {
      mockPrismaService.trip.findMany.mockResolvedValue([]);

      const result = await service.searchTrips('nonexistent-route');

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create a trip successfully', async () => {
      mockPrismaService.trip.create.mockResolvedValue(mockTrip);

      const result = await service.create({
        routeId: 'route-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        departureTime: new Date(Date.now() + 86400000).toISOString(),
        priceEGP: 100,
        availableSeats: 14,
      });

      expect(result).toBeDefined();
    });

    it('should throw BadRequestException for past departure time', async () => {
      await expect(
        service.create({
          routeId: 'route-1',
          departureTime: new Date(Date.now() - 86400000).toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should throw NotFoundException if trip does not exist', async () => {
      mockPrismaService.trip.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update trip fields', async () => {
      mockPrismaService.trip.findUnique.mockResolvedValue(mockTrip);
      mockPrismaService.trip.update.mockResolvedValue({
        ...mockTrip,
        priceEGP: 150,
      });

      const result = await service.update('trip-1', { priceEGP: 150 });

      expect(result).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should soft-delete a trip', async () => {
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          trip: {
            update: jest.fn().mockResolvedValue(mockTrip),
          },
          booking: {
            findMany: jest.fn().mockResolvedValue([]),
            updateMany: jest.fn(),
          },
        };
        return cb(tx);
      });

      await expect(service.delete('trip-1')).resolves.toBeUndefined();
    });
  });

  describe('incrementBookedSeats', () => {
    it('should throw BadRequestException if insufficient seats', async () => {
      mockPrismaService.trip.update.mockResolvedValue(null);

      await expect(service.incrementBookedSeats('trip-1', 99)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should increment booked seats atomically', async () => {
      mockPrismaService.trip.update.mockResolvedValue(mockTrip);

      const result = await service.incrementBookedSeats('trip-1', 2);

      expect(result).toBeDefined();
    });
  });

  describe('findByDriver', () => {
    it('should return trips for a driver', async () => {
      mockPrismaService.trip.findMany.mockResolvedValue([mockTrip]);

      const result = await service.findByDriver('driver-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('updateTripStatus', () => {
    it('should throw NotFoundException if trip not found', async () => {
      mockPrismaService.trip.findUnique.mockResolvedValue(null);

      await expect(
        service.updateTripStatus('nonexistent', 'driver-1', 'BOARDING'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not assigned driver', async () => {
      mockPrismaService.trip.findUnique.mockResolvedValue(mockTrip);

      const wrongDriver = { ...mockDriver, id: 'other-driver' };
      mockPrismaService.user.findUnique.mockResolvedValue(wrongDriver);

      await expect(
        service.updateTripStatus('trip-1', 'other-driver', 'BOARDING'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to update trip status', async () => {
      mockPrismaService.trip.findUnique.mockResolvedValue(mockTrip);
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdmin);
      mockPrismaService.trip.update.mockResolvedValue({
        ...mockTrip,
        status: 'IN_TRANSIT',
      });

      const result = await service.updateTripStatus(
        'trip-1',
        'admin-1',
        'IN_TRANSIT',
      );

      expect(result).toBeDefined();
    });
  });
});
