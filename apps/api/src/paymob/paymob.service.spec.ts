import { Test, TestingModule } from '@nestjs/testing';
import { PaymobService } from './paymob.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

jest.mock('crypto', () => ({
  randomInt: jest.fn().mockReturnValue(123456789),
  createHmac: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('valid-hmac'),
  }),
  randomBytes: jest.fn().mockReturnValue(Buffer.from('test-bytes')),
}));

describe('PaymobService', () => {
  let service: PaymobService;
  let mockPrismaService: any;
  let mockBookingsService: any;
  let mockConfigService: any;

  const mockBooking = {
    id: 'booking-1',
    userId: 'user-1',
    tripId: 'trip-1',
    amountEGP: 100,
    status: 'PENDING_PAYMENT',
    paymentStatus: 'PENDING',
    seatNumbers: [1],
  };

  const mockUser = {
    id: 'user-1',
    walletBalance: 500,
  };

  function makeMockTx() {
    return {
      transaction: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      booking: {
        findUnique: jest.fn().mockResolvedValue(mockBooking),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
        update: jest.fn(),
      },
    };
  }

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          'paymob.hmacSecret': 'test-hmac-secret',
          'paymob.apiKey': '',
          'paymob.publicKey': '',
          'paymob.iframeId': '',
          'paymob.integrationId': '',
          'paymob.walletIntegrationId': '',
          'paymob.apiBaseUrl': 'https://accept.paymob.com',
          clientUrl: 'http://localhost:5173',
          nodeEnv: 'development',
        };
        return config[key] !== undefined ? config[key] : defaultValue;
      }),
    };

    mockPrismaService = {
      booking: { findUnique: jest.fn(), update: jest.fn() },
      transaction: { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() },
      user: { findUnique: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(),
    };

    mockBookingsService = {
      cleanupExpiredBookings: jest.fn().mockResolvedValue(0),
      updateStatus: jest.fn().mockResolvedValue(true),
      notificationsService: {
        sendBookingConfirmation: jest.fn().mockResolvedValue(true),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymobService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: BookingsService, useValue: mockBookingsService },
      ],
    }).compile();

    service = module.get<PaymobService>(PaymobService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processWebhook', () => {
    it('should throw BadRequestException for invalid HMAC', async () => {
      await expect(
        service.processWebhook(
          { obj: { order: { id: 123 }, amount_cents: 10000, success: true } as any } as any,
          '',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should process wallet topup webhook', async () => {
      const walletOrderId = `wallet_user-1_${Date.now()}`;
      const payload = {
        obj: {
          order: { id: 456, merchant_order_id: walletOrderId },
          amount_cents: 5000, success: true, id: 'txn-1',
          payment_key_claims: { pm: 'CARD' },
          created_at: new Date().toISOString(), currency: 'EGP', error_occured: false,
          has_parent_transaction: false, integration_id: '123', is_3d_secure: false,
          is_auth: false, is_capture: true, is_refunded: false, is_standalone_payment: true,
          is_voided: false, owner: 0, pending: false,
          source_data: { pan: '****', sub_type: 'CARD', type: 'CREDIT' },
        } as any,
      } as any;

      mockPrismaService.$transaction.mockImplementation(async (cb: any) => cb(makeMockTx()));

      await expect(service.processWebhook(payload, 'valid-hmac')).resolves.toBeUndefined();
    });

    it('should process standard booking webhook', async () => {
      const payload = {
        obj: {
          order: { id: 789, merchant_order_id: 'booking-1' },
          amount_cents: 10000, success: true, id: 'txn-2',
          payment_key_claims: { pm: 'CARD' },
          created_at: new Date().toISOString(), currency: 'EGP', error_occured: false,
          has_parent_transaction: false, integration_id: '123', is_3d_secure: false,
          is_auth: false, is_capture: true, is_refunded: false, is_standalone_payment: true,
          is_voided: false, owner: 0, pending: false,
          source_data: { pan: '****', sub_type: 'CARD', type: 'CREDIT' },
        } as any,
      } as any;

      mockPrismaService.$transaction.mockImplementation(async (cb: any) => cb(makeMockTx()));

      mockPrismaService.booking.findUnique
        .mockResolvedValueOnce(mockBooking)
        .mockResolvedValueOnce({
          ...mockBooking, status: 'CONFIRMED', user: mockUser,
          trip: { route: { name: 'Test Route' }, departureTime: new Date() },
        });

      await expect(service.processWebhook(payload, 'valid-hmac')).resolves.toBeUndefined();
    });
  });

  describe('initializeCheckout', () => {
    it('should handle wallet balance payment', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => cb(makeMockTx()));

      const result = await service.initializeCheckout({
        bookingId: 'booking-1', amountCents: 10000, paymentMethod: 'WALLET_BALANCE',
      });

      expect(result.paymentKey).toBe('wallet_balance');
    });

    it('should throw BadRequestException for insufficient wallet balance', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => {
        return cb({
          ...makeMockTx(),
          user: { findUnique: jest.fn().mockResolvedValue({ ...mockUser, walletBalance: 10 }) },
        });
      });

      await expect(
        service.initializeCheckout({ bookingId: 'booking-1', amountCents: 100000, paymentMethod: 'WALLET_BALANCE' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use mock flow when no API key configured', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);

      const result = await service.initializeCheckout({
        bookingId: 'booking-1', amountCents: 10000, paymentMethod: 'CARD',
      });

      expect(result.paymentKey).toContain('pk_test_');
      expect(result.iframeUrl).toContain('/payment/callback');
    });
  });

  describe('getUserWallet', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.getUserWallet('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should return wallet balance and transactions', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.transaction.findMany.mockResolvedValue([
        {
          id: 'txn-1', amountEGP: 100, status: 'SUCCESS', paymentMethod: 'CARD', createdAt: new Date(),
          booking: { id: 'booking-1', seatNumbers: [1], trip: { route: { name: 'Test Route' } } },
        },
      ]);

      const result = await service.getUserWallet('user-1');

      expect(result.walletBalance).toBe(500);
      expect(result.transactions).toHaveLength(1);
    });
  });

  describe('confirmPaymentDirect', () => {
    it('should process wallet topup confirmation', async () => {
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      mockPrismaService.$transaction.mockImplementation(async (cb: any) => cb(makeMockTx()));

      await expect(service.confirmPaymentDirect(`wallet_user-1_${Date.now()}`, 50)).resolves.toBeUndefined();
    });

    it('should skip if wallet topup already confirmed', async () => {
      mockPrismaService.transaction.findFirst.mockResolvedValue({ id: 'existing-tx' });
      await expect(service.confirmPaymentDirect('wallet_user-1_12345')).resolves.toBeUndefined();
    });
  });

  describe('verifyTransactionOnPaymob', () => {
    it('should return false if no API key configured', async () => {
      const result = await service.verifyTransactionOnPaymob('order-1');
      expect(result).toBe(false);
    });
  });

  describe('isCashAllowed', () => {
    it('should return false', () => {
      expect(service.isCashAllowed()).toBe(false);
    });
  });
});
