import { Test, TestingModule } from '@nestjs/testing';
import { PromoCodesService } from './promo-codes.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PromoCodesService', () => {
  let service: PromoCodesService;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaService = {
      promoCode: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      trip: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromoCodesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PromoCodesService>(PromoCodesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validatePromoCode', () => {
    const mockTrip = {
      id: 'trip-1',
      priceEGP: 100,
      route: {
        checkpoints: [
          { id: 'stop-1', name: 'Start Stop', priceFromStartEGP: 0 },
          { id: 'stop-2', name: 'End Stop', priceFromStartEGP: 100 },
        ],
      },
    };

    it('should throw BadRequestException if promo code does not exist', async () => {
      mockPrismaService.promoCode.findUnique.mockResolvedValue(null);

      await expect(
        service.validatePromoCode('INVALID', 'trip-1', [1]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if promo code is inactive', async () => {
      mockPrismaService.promoCode.findUnique.mockResolvedValue({
        id: 'promo-1',
        code: 'INACTIVE',
        isActive: false,
      });

      await expect(
        service.validatePromoCode('INACTIVE', 'trip-1', [1]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if promo code is expired', async () => {
      mockPrismaService.promoCode.findUnique.mockResolvedValue({
        id: 'promo-1',
        code: 'EXPIRED',
        isActive: true,
        expiryDate: new Date(Date.now() - 10000), // in the past
      });

      await expect(
        service.validatePromoCode('EXPIRED', 'trip-1', [1]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if usage limit is reached', async () => {
      mockPrismaService.promoCode.findUnique.mockResolvedValue({
        id: 'promo-1',
        code: 'LIMIT_REACHED',
        isActive: true,
        usageLimit: 10,
        usageCount: 10,
      });

      await expect(
        service.validatePromoCode('LIMIT_REACHED', 'trip-1', [1]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if minimum booking amount is not met', async () => {
      mockPrismaService.promoCode.findUnique.mockResolvedValue({
        id: 'promo-1',
        code: 'MIN_LIMIT',
        isActive: true,
        minBookingAmountEGP: 200,
        discountType: 'FIXED',
        discountValue: 20,
      });

      mockPrismaService.trip.findUnique.mockResolvedValue(mockTrip);

      await expect(
        service.validatePromoCode(
          'MIN_LIMIT',
          'trip-1',
          [1],
          'stop-1',
          'stop-2',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should calculate fixed discount correctly', async () => {
      mockPrismaService.promoCode.findUnique.mockResolvedValue({
        id: 'promo-1',
        code: 'FIXED20',
        isActive: true,
        minBookingAmountEGP: 50,
        discountType: 'FIXED',
        discountValue: 20,
      });

      mockPrismaService.trip.findUnique.mockResolvedValue(mockTrip);

      const result = await service.validatePromoCode(
        'FIXED20',
        'trip-1',
        [1],
        'stop-1',
        'stop-2',
      );

      expect(result.valid).toBe(true);
      expect(result.discountEGP).toBe(20);
      expect(result.finalAmountEGP).toBe(80);
    });

    it('should calculate percentage discount correctly', async () => {
      mockPrismaService.promoCode.findUnique.mockResolvedValue({
        id: 'promo-1',
        code: 'PCT50',
        isActive: true,
        minBookingAmountEGP: 50,
        discountType: 'PERCENTAGE',
        discountValue: 50,
        maxDiscountEGP: 30, // maximum discount limit
      });

      mockPrismaService.trip.findUnique.mockResolvedValue(mockTrip);

      // Without max limit: 50% of 100 is 50. But max limit is 30.
      const result = await service.validatePromoCode(
        'PCT50',
        'trip-1',
        [1],
        'stop-1',
        'stop-2',
      );

      expect(result.valid).toBe(true);
      expect(result.discountEGP).toBe(30); // clamped to maxDiscountEGP
      expect(result.finalAmountEGP).toBe(70);
    });
  });
});
