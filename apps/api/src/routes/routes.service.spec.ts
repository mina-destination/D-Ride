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

  describe('findNearestCheckpoints', () => {
    it('should find closest checkpoints across all routes', async () => {
      const mockRoutes = [
        {
          id: 'route-1',
          name: 'Heliopolis to Maadi',
          checkpoints: [
            {
              name: 'Maadi Stop',
              location: {
                type: 'Point',
                coordinates: [31.25, 29.96],
              },
            },
          ],
        },
        {
          id: 'route-2',
          name: 'Dokki to Heliopolis',
          checkpoints: [
            {
              name: 'Dokki Stop',
              location: {
                type: 'Point',
                coordinates: [31.21, 30.04],
              },
            },
          ],
        },
      ];

      mockPrismaService.route.findMany = jest.fn().mockResolvedValue(mockRoutes);

      const results = await service.findNearestCheckpoints(31.211, 30.041, 2);

      expect(results).toHaveLength(2);
      expect(results[0].checkpoint.name).toBe('Dokki Stop');
      expect(results[0].route.name).toBe('Dokki to Heliopolis');
      expect(results[1].checkpoint.name).toBe('Maadi Stop');
    });
  });
});
