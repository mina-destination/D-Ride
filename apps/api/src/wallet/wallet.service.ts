import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymobService } from '../paymob/paymob.service';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymobService: PaymobService,
  ) {}

  async getBalanceAndTransactions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        status: { in: [PaymentStatus.SUCCESS, PaymentStatus.FAILED] }
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      walletBalance: user.walletBalance,
      transactions,
    };
  }

  async initializeDeposit(userId: string, amountEGP: number, email: string, name: string) {
    if (!amountEGP || amountEGP <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    // 1. Create a pending transaction record
    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        amountEGP,
        status: PaymentStatus.PENDING,
        paymentMethod: 'WALLET_DEPOSIT',
      },
    });

    // 2. Call Paymob to initialize a checkout session
    const amountCents = Math.round(amountEGP * 100);
    const billingData = {
      apartment: 'NA',
      email: email || 'passenger@dride.com',
      floor: 'NA',
      first_name: name.split(' ')[0] || 'John',
      street: 'NA',
      building: 'NA',
      phone_number: '+201000000000',
      shipping_method: 'NA',
      postal_code: 'NA',
      city: 'Cairo',
      country: 'EG',
      last_name: name.split(' ')[1] || 'Doe',
      state: 'NA',
    };

    try {
      const checkoutRes = await this.paymobService.initializeCheckout({
        bookingId: transaction.id,
        amountCents,
        billingData,
        paymentMethod: 'CARD',
      });

      return {
        transactionId: transaction.id,
        paymentKey: checkoutRes.paymentKey,
        iframeUrl: checkoutRes.iframeUrl,
        redirectUrl: checkoutRes.redirectUrl,
      };
    } catch (err: any) {
      // Clean up transaction
      await this.prisma.transaction.delete({ where: { id: transaction.id } }).catch(() => {});
      throw new BadRequestException(`Failed to initialize payment gateway: ${err.message}`);
    }
  }
}
