import { Test, TestingModule } from '@nestjs/testing';
import { PromoCodesController } from './promo-codes.controller';
import { PromoCodesService } from './promo-codes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ExecutionContext } from '@nestjs/common';

describe('PromoCodesController', () => {
  let controller: PromoCodesController;
  let service: PromoCodesService;

  const mockPromoCodesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    validatePromoCode: jest.fn(),
  };

  const mockAuthGuard = {
    canActivate: (context: ExecutionContext) => true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromoCodesController],
      providers: [
        {
          provide: PromoCodesService,
          useValue: mockPromoCodesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<PromoCodesController>(PromoCodesController);
    service = module.get<PromoCodesService>(PromoCodesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all promo codes', async () => {
      const mockResult = [{ id: '1', code: 'DISCOUNT10' }];
      mockPromoCodesService.findAll.mockResolvedValue(mockResult);

      const response = await controller.findAll();

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a promo code by ID', async () => {
      const mockResult = { id: '1', code: 'DISCOUNT10' };
      mockPromoCodesService.findOne.mockResolvedValue(mockResult);

      const response = await controller.findOne('1');

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(service.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('create', () => {
    it('should create a new promo code', async () => {
      const createDto = {
        code: 'DISCOUNT10',
        discountType: 'PERCENTAGE' as const,
        discountValue: 10,
        minBookingAmountEGP: 50,
        expiryDate: new Date(),
        isActive: true,
      };
      const mockResult = { id: '1', ...createDto };
      mockPromoCodesService.create.mockResolvedValue(mockResult);

      const response = await controller.create(createDto);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('validate', () => {
    it('should validate promo code', async () => {
      const mockResult = { isValid: true, discountEGP: 15 };
      mockPromoCodesService.validatePromoCode.mockResolvedValue(mockResult);

      const response = await controller.validate('DISCOUNT10', 'trip-1', [1]);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(service.validatePromoCode).toHaveBeenCalledWith(
        'DISCOUNT10',
        'trip-1',
        [1],
        undefined,
        undefined,
      );
    });
  });
});
