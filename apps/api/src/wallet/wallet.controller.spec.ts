import { Test, TestingModule } from '@nestjs/testing';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';

describe('WalletController', () => {
  let controller: WalletController;
  let walletService: WalletService;

  const mockWalletService = {
    getBalanceAndTransactions: jest.fn(),
    initializeDeposit: jest.fn(),
  };

  const mockAuthGuard = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = { sub: 'test-user-id', email: 'test@example.com' };
      return true;
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [
        {
          provide: WalletService,
          useValue: mockWalletService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<WalletController>(WalletController);
    walletService = module.get<WalletService>(WalletService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getBalance', () => {
    it('should return balance and transaction history', async () => {
      const mockResult = { balance: 500, transactions: [] };
      mockWalletService.getBalanceAndTransactions.mockResolvedValue(mockResult);

      const req = { user: { sub: 'test-user-id' } };
      const response = await controller.getBalance(req);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(mockWalletService.getBalanceAndTransactions).toHaveBeenCalledWith(
        'test-user-id',
      );
    });
  });

  describe('initializeDeposit', () => {
    it('should initialize paymob checkout link for deposit', async () => {
      const mockResult = { checkoutUrl: 'https://paymob.com/checkout' };
      mockWalletService.initializeDeposit.mockResolvedValue(mockResult);

      const req = { user: { sub: 'test-user-id', email: 'test@example.com' } };
      const response = await controller.initializeDeposit(req, 100);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(mockWalletService.initializeDeposit).toHaveBeenCalledWith(
        'test-user-id',
        100,
        'test@example.com',
        'Valued Passenger',
      );
    });
  });
});
