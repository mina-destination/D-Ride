import { Test, TestingModule } from '@nestjs/testing';
import { RoutesService } from './routes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RoutesService', () => {
  let service: RoutesService;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaService = {
      route: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
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
        id: 'route-1',
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

      mockPrismaService.route.findUnique.mockResolvedValue(mockRoute);

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
        id: 'route-2',
        checkpoints: [],
      };

      mockPrismaService.route.findUnique.mockResolvedValue(mockRoute);

      const result = await service.findNearestCheckpoint(
        'route-2',
        31.229,
        30.041,
      );
      expect(result).toBeNull();
    });
  });
});
