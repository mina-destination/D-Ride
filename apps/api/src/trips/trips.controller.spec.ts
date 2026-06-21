import { Test, TestingModule } from '@nestjs/testing';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { UpdateTripStatusDto } from './dto/update-trip-status.dto';
import { TripStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

describe('TripsController', () => {
  let controller: TripsController;
  let service: TripsService;

  const mockTripsService = {
    findAll: jest.fn(),
    searchTrips: jest.fn(),
    findByDriver: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    updateTripStatus: jest.fn(),
    getArrivedCheckpoints: jest.fn(),
    updateArrivedCheckpoints: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TripsController],
      providers: [
        {
          provide: TripsService,
          useValue: mockTripsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TripsController>(TripsController);
    service = module.get<TripsService>(TripsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all trips', async () => {
      const mockResult = [{ id: '1' }];
      mockTripsService.findAll.mockResolvedValue(mockResult);

      const response = await controller.findAll();
      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should search trips', async () => {
      const mockResult = [{ id: '1' }];
      mockTripsService.searchTrips.mockResolvedValue(mockResult);

      const response = await controller.search(
        'route-1',
        '2026-06-21',
        'pickup',
        'dropoff',
      );
      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(service.searchTrips).toHaveBeenCalledWith(
        'route-1',
        '2026-06-21',
        'pickup',
        'dropoff',
      );
    });
  });

  describe('findMyTrips', () => {
    it('should return trips for logged in driver', async () => {
      const req = { user: { sub: 'driver-1' } };
      const mockResult = [{ id: '1' }];
      mockTripsService.findByDriver.mockResolvedValue(mockResult);

      const response = await controller.findMyTrips(req);
      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(service.findByDriver).toHaveBeenCalledWith('driver-1');
    });
  });

  describe('findById', () => {
    it('should return a trip by ID', async () => {
      const mockResult = { id: '1' };
      mockTripsService.findById.mockResolvedValue(mockResult);

      const response = await controller.findById(
        '1',
        'pickup',
        'dropoff',
        'route-1',
      );
      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(service.findById).toHaveBeenCalledWith(
        '1',
        'pickup',
        'dropoff',
        'route-1',
      );
    });
  });

  describe('create', () => {
    it('should create a trip', async () => {
      const dto: CreateTripDto = {
        routeId: 'route-1',
        driverId: 'driver-1',
        vehicleId: 'vehicle-1',
        departureTime: new Date().toISOString(),
        availableSeats: 14,
      };
      const mockResult = { id: '1', ...dto };
      mockTripsService.create.mockResolvedValue(mockResult);

      const response = await controller.create(dto);
      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should update a trip', async () => {
      const dto: UpdateTripDto = {
        availableSeats: 10,
      };
      const mockResult = { id: '1', availableSeats: 10 };
      mockTripsService.update.mockResolvedValue(mockResult);

      const response = await controller.update('1', dto);
      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(service.update).toHaveBeenCalledWith('1', dto);
    });
  });

  describe('delete', () => {
    it('should delete a trip', async () => {
      mockTripsService.delete.mockResolvedValue(undefined);

      const response = await controller.delete('1');
      expect(response.success).toBe(true);
      expect(response.message).toBe('Trip deleted');
      expect(service.delete).toHaveBeenCalledWith('1');
    });
  });

  describe('updateStatus', () => {
    it('should update trip status', async () => {
      const req = { user: { sub: 'driver-1' } };
      const dto: UpdateTripStatusDto = {
        status: TripStatus.EN_ROUTE,
      };
      const mockResult = { id: '1', status: 'EN_ROUTE' };
      mockTripsService.updateTripStatus.mockResolvedValue(mockResult);

      const response = await controller.updateStatus('1', dto, req);
      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(service.updateTripStatus).toHaveBeenCalledWith(
        '1',
        'driver-1',
        TripStatus.EN_ROUTE,
      );
    });

    it('should throw BadRequestException if update fails', async () => {
      const req = { user: { sub: 'driver-1' } };
      const dto: UpdateTripStatusDto = {
        status: TripStatus.EN_ROUTE,
      };
      mockTripsService.updateTripStatus.mockRejectedValue(
        new Error('Update failed'),
      );

      await expect(controller.updateStatus('1', dto, req)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getArrivedCheckpoints', () => {
    it('should return arrived checkpoints', async () => {
      const mockResult = ['cp-1'];
      mockTripsService.getArrivedCheckpoints.mockResolvedValue(mockResult);

      const response = await controller.getArrivedCheckpoints('1');
      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(service.getArrivedCheckpoints).toHaveBeenCalledWith('1');
    });

    it('should throw BadRequestException on error', async () => {
      mockTripsService.getArrivedCheckpoints.mockRejectedValue(
        new Error('Failed'),
      );
      await expect(controller.getArrivedCheckpoints('1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateArrivedCheckpoints', () => {
    it('should update arrived checkpoints list', async () => {
      const body = { arrivedCheckpoints: ['cp-1', 'cp-2'] };
      const mockResult = { id: '1', arrivedCheckpoints: ['cp-1', 'cp-2'] };
      mockTripsService.updateArrivedCheckpoints.mockResolvedValue(mockResult);

      const response = await controller.updateArrivedCheckpoints('1', body);
      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(service.updateArrivedCheckpoints).toHaveBeenCalledWith(
        '1',
        body.arrivedCheckpoints,
      );
    });

    it('should throw BadRequestException on error', async () => {
      const body = { arrivedCheckpoints: ['cp-1', 'cp-2'] };
      mockTripsService.updateArrivedCheckpoints.mockRejectedValue(
        new Error('Failed'),
      );
      await expect(
        controller.updateArrivedCheckpoints('1', body),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
