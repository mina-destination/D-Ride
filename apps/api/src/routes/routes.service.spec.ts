import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { RoutesService } from './routes.service';
import { Route } from '../schemas/route.schema';

describe('RoutesService', () => {
  let service: RoutesService;
  let mockRouteModel: any;

  beforeEach(async () => {
    mockRouteModel = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutesService,
        {
          provide: getModelToken(Route.name),
          useValue: mockRouteModel,
        },
      ],
    }).compile();

    service = module.get<RoutesService>(RoutesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findNearestCheckpoint', () => {
    it('should return the closest checkpoint by distance', async () => {
      const mockRoute = {
        _id: 'route-1',
        checkpoints: [
          {
            name: 'Far Point',
            location: {
              type: 'Point',
              coordinates: [31.25, 30.05], // lng, lat
            },
            order: 1,
          },
          {
            name: 'Close Point',
            location: {
              type: 'Point',
              coordinates: [31.23, 30.04], // lng, lat
            },
            order: 2,
          },
        ],
      };

      mockRouteModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRoute),
      });

      // User location close to "Close Point" (31.23, 30.04)
      const result = await service.findNearestCheckpoint(
        'route-1',
        31.229,
        30.041,
      );

      expect(result).toBeDefined();
      expect(result?.name).toBe('Close Point');
    });

    it('should return null if route has no checkpoints', async () => {
      const mockRoute = {
        _id: 'route-2',
        checkpoints: [],
      };

      mockRouteModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRoute),
      });

      const result = await service.findNearestCheckpoint(
        'route-2',
        31.229,
        30.041,
      );
      expect(result).toBeNull();
    });
  });
});
