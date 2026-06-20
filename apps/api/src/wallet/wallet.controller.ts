import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  async getBalance(@Request() req: any) {
    const userId = req.user.sub;
    const result = await this.walletService.getBalanceAndTransactions(userId);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('deposit')
  async initializeDeposit(@Request() req: any, @Body('amount') amount: number) {
    const userId = req.user.sub;
    const email = req.user.email;
    const result = await this.walletService.initializeDeposit(userId, amount, email, 'Valued Passenger');
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}
