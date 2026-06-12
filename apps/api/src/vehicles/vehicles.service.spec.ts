import { Test, TestingModule } from '@nestjs/testing';
import { VehiclesService } from './vehicles.service';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesGateway } from './vehicles.gateway';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('VehiclesService', () => {
  let service: VehiclesService;
  let mockPrismaService: any;
  let mockVehiclesGateway: any;

  const mockVehicle = {
    id: 'vehicle-1',
    model: 'Toyota::Hiace',
    plateNumber: 'ABC123',
    capacity: 14,
    driverId: 'driver-1',
    type: 'SHUTTLE_BUS',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLocation = {
    id: 'loc-1',
    vehicleId: 'vehicle-1',
    driverId: 'driver-1',
    location: {
      type: 'Point',
      coordinates: [31.23, 30.04],
    },
    lastUpdatedAt: new Date(),
    status: 'ACTIVE',
  };

  const mockDriverUser = {
    sub: 'driver-1',
    role: 'DRIVER',
  };

  beforeEach(async () => {
    mockPrismaService = {
      vehicle: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      liveVehicleLocation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    mockVehiclesGateway = {
      broadcastVehicleLocation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehiclesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: VehiclesGateway,
          useValue: mockVehiclesGateway,
        },
      ],
    }).compile();

    service = module.get<VehiclesService>(VehiclesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllVehicles', () => {
    it('should return all vehicles', async () => {
      mockPrismaService.vehicle.findMany.mockResolvedValue([mockVehicle]);

      const result = await service.findAllVehicles();

      expect(result).toHaveLength(1);
      expect(result[0].make).toBe('Toyota');
      expect(result[0].model).toBe('Hiace');
    });
  });

  describe('createVehicle', () => {
    it('should create a vehicle', async () => {
      mockPrismaService.vehicle.create.mockResolvedValue(mockVehicle);

      const result = await service.createVehicle({
        make: 'Toyota',
        model: 'Hiace',
        licensePlate: 'ABC123',
        capacity: 14,
      });

      expect(result).toBeDefined();
      expect(result.make).toBe('Toyota');
    });
  });

  describe('updateVehicle', () => {
    it('should update a vehicle', async () => {
      mockPrismaService.vehicle.update.mockResolvedValue({
        ...mockVehicle,
        plateNumber: 'XYZ789',
      });

      const result = await service.updateVehicle('vehicle-1', {
        licensePlate: 'XYZ789',
      });

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if vehicle not found', async () => {
      mockPrismaService.vehicle.update.mockRejectedValue(new Error());

      await expect(
        service.updateVehicle('nonexistent', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteVehicle', () => {
    it('should delete a vehicle', async () => {
      mockPrismaService.vehicle.delete.mockResolvedValue(mockVehicle);

      const result = await service.deleteVehicle('vehicle-1');

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if vehicle not found', async () => {
      mockPrismaService.vehicle.delete.mockRejectedValue(new Error());

      await expect(service.deleteVehicle('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('upsertLocation', () => {
    it('should throw ForbiddenException if driver updates another driver vehicle', async () => {
      await expect(
        service.upsertLocation(
          {
            vehicleId: 'vehicle-1',
            driverId: 'other-driver',
            longitude: 31.23,
            latitude: 30.04,
          },
          { sub: 'driver-1', role: 'DRIVER' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create new location entry if none exists', async () => {
      mockPrismaService.vehicle.findUnique.mockResolvedValue(mockVehicle);
      mockPrismaService.liveVehicleLocation.findFirst.mockResolvedValue(null);
      mockPrismaService.liveVehicleLocation.create.mockResolvedValue(mockLocation);

      const result = await service.upsertLocation(
        {
          vehicleId: 'vehicle-1',
          driverId: 'driver-1',
          longitude: 31.23,
          latitude: 30.04,
        },
        mockDriverUser,
      );

      expect(result).toBeDefined();
      expect(mockVehiclesGateway.broadcastVehicleLocation).toHaveBeenCalled();
    });

    it('should update existing location entry', async () => {
      mockPrismaService.vehicle.findUnique.mockResolvedValue(mockVehicle);
      mockPrismaService.liveVehicleLocation.findFirst.mockResolvedValue(mockLocation);
      mockPrismaService.liveVehicleLocation.update.mockResolvedValue(mockLocation);

      const result = await service.upsertLocation(
        {
          vehicleId: 'vehicle-1',
          driverId: 'driver-1',
          longitude: 31.24,
          latitude: 30.05,
        },
        mockDriverUser,
      );

      expect(result).toBeDefined();
    });
  });

  describe('getLocation', () => {
    it('should throw NotFoundException if no location', async () => {
      mockPrismaService.liveVehicleLocation.findFirst.mockResolvedValue(null);

      await expect(service.getLocation('vehicle-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return vehicle location', async () => {
      mockPrismaService.liveVehicleLocation.findFirst.mockResolvedValue(mockLocation);

      const result = await service.getLocation('vehicle-1');

      expect(result).toBeDefined();
    });
  });

  describe('getNearbyVehicles', () => {
    it('should return nearby vehicles based on distance', async () => {
      mockPrismaService.liveVehicleLocation.findMany.mockResolvedValue([
        mockLocation,
      ]);

      const result = await service.getNearbyVehicles(31.23, 30.04, 5000);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('markVehicleOffline', () => {
    it('should mark vehicle offline', async () => {
      mockPrismaService.liveVehicleLocation.findFirst.mockResolvedValue(mockLocation);
      mockPrismaService.liveVehicleLocation.update.mockResolvedValue({
        ...mockLocation,
        status: 'OFFLINE',
      });

      const result = await service.markVehicleOffline('vehicle-1');

      expect(result).toBeDefined();
    });

    it('should not throw if no location exists', async () => {
      mockPrismaService.liveVehicleLocation.findFirst.mockResolvedValue(null);

      const result = await service.markVehicleOffline('vehicle-1');

      expect(result).toBeUndefined();
    });
  });
});
