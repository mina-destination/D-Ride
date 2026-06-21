import { Test, TestingModule } from '@nestjs/testing';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

describe('RoutesController', () => {
  let controller: RoutesController;
  let service: RoutesService;

  const mockRoutesService = {
    findAll: jest.fn(),
    findNearby: jest.fn(),
    findNearestCheckpoints: jest.fn(),
    smartSearch: jest.fn(),
    findById: jest.fn(),
    findNearestCheckpoint: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoutesController],
      providers: [
        {
          provide: RoutesService,
          useValue: mockRoutesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RoutesController>(RoutesController);
    service = module.get<RoutesService>(RoutesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all routes', async () => {
      const mockRoutes = [{ id: 'route-1' }];
      mockRoutesService.findAll.mockResolvedValue(mockRoutes);

      const res = await controller.findAll('true', 'false');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockRoutes);
      expect(service.findAll).toHaveBeenCalledWith(true, false);
    });

    it('should default options to false when not provided', async () => {
      const mockRoutes = [{ id: 'route-1' }];
      mockRoutesService.findAll.mockResolvedValue(mockRoutes);

      const res = await controller.findAll();
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockRoutes);
      expect(service.findAll).toHaveBeenCalledWith(false, false);
    });
  });

  describe('findNearby', () => {
    it('should find routes near coordinates', async () => {
      const mockRoutes = [{ id: 'route-1' }];
      mockRoutesService.findNearby.mockResolvedValue(mockRoutes);

      const res = await controller.findNearby('30.0', '31.0', '1000');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockRoutes);
      expect(service.findNearby).toHaveBeenCalledWith(31.0, 30.0, 1000);
    });

    it('should use default radius if not provided', async () => {
      const mockRoutes = [{ id: 'route-1' }];
      mockRoutesService.findNearby.mockResolvedValue(mockRoutes);

      const res = await controller.findNearby('30.0', '31.0');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockRoutes);
      expect(service.findNearby).toHaveBeenCalledWith(31.0, 30.0, 5000);
    });
  });

  describe('findNearest', () => {
    it('should find nearest checkpoints', async () => {
      const mockResults = [{ checkpoint: {}, distance: 100 }];
      mockRoutesService.findNearestCheckpoints.mockResolvedValue(mockResults);

      const res = await controller.findNearest('30.0', '31.0', '10');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockResults);
      expect(service.findNearestCheckpoints).toHaveBeenCalledWith(
        31.0,
        30.0,
        10,
      );
    });

    it('should use default limit if not provided', async () => {
      const mockResults = [{ checkpoint: {}, distance: 100 }];
      mockRoutesService.findNearestCheckpoints.mockResolvedValue(mockResults);

      const res = await controller.findNearest('30.0', '31.0');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockResults);
      expect(service.findNearestCheckpoints).toHaveBeenCalledWith(
        31.0,
        30.0,
        5,
      );
    });
  });

  describe('smartSearch', () => {
    it('should search using geo coordinates and parameters', async () => {
      const mockResults = [{ route: {} }];
      mockRoutesService.smartSearch.mockResolvedValue(mockResults);

      const res = await controller.smartSearch(
        '30.0',
        '31.0',
        '30.5',
        '31.5',
        '2000',
        'Cairo',
        'Alex',
        '2026-06-21',
      );
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockResults);
      expect(service.smartSearch).toHaveBeenCalledWith(
        31.0,
        30.0,
        31.5,
        30.5,
        2000,
        'Cairo',
        'Alex',
        '2026-06-21',
      );
    });

    it('should handle undefined params with default values', async () => {
      const mockResults = [];
      mockRoutesService.smartSearch.mockResolvedValue(mockResults);

      const res = await controller.smartSearch();
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockResults);
      expect(service.smartSearch).toHaveBeenCalledWith(
        0,
        0,
        0,
        0,
        5000,
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('findById', () => {
    it('should return a route by ID', async () => {
      const mockRoute = { id: 'route-1' };
      mockRoutesService.findById.mockResolvedValue(mockRoute);

      const res = await controller.findById('route-1');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockRoute);
      expect(service.findById).toHaveBeenCalledWith('route-1');
    });
  });

  describe('findNearestCheckpoint', () => {
    it('should return the nearest checkpoint on a route', async () => {
      const mockCheckpoint = { id: 'cp-1' };
      mockRoutesService.findNearestCheckpoint.mockResolvedValue(mockCheckpoint);

      const res = await controller.findNearestCheckpoint(
        'route-1',
        '30.0',
        '31.0',
      );
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockCheckpoint);
      expect(service.findNearestCheckpoint).toHaveBeenCalledWith(
        'route-1',
        31.0,
        30.0,
      );
    });
  });

  describe('create', () => {
    it('should create a route', async () => {
      const createRouteDto: CreateRouteDto = {
        name: 'New Route',
        type: 'INTERCITY',
        checkpoints: [],
      };
      const mockRoute = { id: 'route-1', ...createRouteDto };
      mockRoutesService.create.mockResolvedValue(mockRoute);

      const res = await controller.create(createRouteDto);
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockRoute);
      expect(service.create).toHaveBeenCalledWith(createRouteDto);
    });
  });

  describe('update', () => {
    it('should update a route', async () => {
      const updateRouteDto: UpdateRouteDto = {
        name: 'Updated Route',
      };
      const mockRoute = { id: 'route-1', name: 'Updated Route' };
      mockRoutesService.update.mockResolvedValue(mockRoute);

      const res = await controller.update('route-1', updateRouteDto);
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockRoute);
      expect(service.update).toHaveBeenCalledWith('route-1', updateRouteDto);
    });
  });

  describe('delete', () => {
    it('should delete a route', async () => {
      mockRoutesService.delete.mockResolvedValue(undefined);

      const res = await controller.delete('route-1');
      expect(res.success).toBe(true);
      expect(res.message).toBe('Route deleted');
      expect(service.delete).toHaveBeenCalledWith('route-1');
    });
  });
});
