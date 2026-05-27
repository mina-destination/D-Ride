import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Logger,
  UsePipes,
  ValidationPipe,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymobService } from './paymob.service';
import { InitializeCheckoutDto } from './dto/initialize-checkout.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('paymob')
export class PaymobController {
  private readonly logger = new Logger(PaymobController.name);

  constructor(
    private readonly paymobService: PaymobService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('webhook')
  @UsePipes(
    new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }),
  )
  async handleWebhook(
    @Body() payload: any,
    @Headers('hmac') hmacHeader: string,
  ) {
    this.logger.log(
      `Received Paymob webhook for order: ${payload?.obj?.order?.id}`,
    );
    await this.paymobService.processWebhook(payload, hmacHeader);
    return {
      success: true,
      message: 'Webhook processed',
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async initializeCheckout(@Request() req: any, @Body() data: InitializeCheckoutDto) {
    // Verify the authenticated user owns the booking
    const booking = await this.prisma.booking.findUnique({ where: { id: data.bookingId } });
    if (booking && booking.userId !== req.user.sub) {
      throw new ForbiddenException('You do not own this booking');
    }
    this.logger.log(`Initializing checkout for booking: ${data.bookingId}`);
    const result = await this.paymobService.initializeCheckout(data);
    return { success: true, data: result, timestamp: new Date().toISOString() };
  }

  @UseGuards(JwtAuthGuard)
  @Post('confirm')
  async confirmPayment(
    @Request() req: any,
    @Body() body: { bookingId: string; success: boolean; amount?: number }
  ) {
    this.logger.log(`Direct confirmation request for: ${body.bookingId}, success: ${body.success}`);
    // Verify ownership: for booking confirmations, check user owns the booking
    if (body.bookingId && !body.bookingId.startsWith('wallet_')) {
      const booking = await this.prisma.booking.findUnique({ where: { id: body.bookingId } });
      if (booking && booking.userId !== req.user.sub) {
        throw new ForbiddenException('You do not own this booking');
      }
    } else if (body.bookingId && body.bookingId.startsWith('wallet_')) {
      // For wallet topups, verify the userId in the merchant_order_id matches
      const parts = body.bookingId.split('_');
      if (parts[1] !== req.user.sub) {
        throw new ForbiddenException('Wallet topup does not belong to you');
      }
    }
    if (body.success && body.bookingId) {
      await this.paymobService.confirmPaymentDirect(body.bookingId, body.amount);
    }
    return { success: true };
  }

  @Get('features')
  async getFeatures() {
    const allowCash = this.paymobService.isCashAllowed();
    return {
      success: true,
      allowCashOnDelivery: allowCash,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('wallet')
  async getWallet(@Request() req: any) {
    this.logger.log(`Fetching wallet ledger for user: ${req.user.sub}`);
    const result = await this.paymobService.getUserWallet(req.user.sub);
    return { success: true, data: result, timestamp: new Date().toISOString() };
  }

  @UseGuards(JwtAuthGuard)
  @Post('wallet/topup')
  async initializeWalletTopup(
    @Request() req: any,
    @Body()
    body: {
      amountEGP: number;
      paymentMethod?: 'CARD' | 'WALLET';
      walletNumber?: string;
    },
  ) {
    this.logger.log(
      `User ${req.user.sub} initiating wallet topup of EGP ${body.amountEGP}`,
    );
    const result = await this.paymobService.initializeWalletTopup({
      userId: req.user.sub,
      amountEGP: body.amountEGP,
      paymentMethod: body.paymentMethod,
      walletNumber: body.walletNumber,
    });
    return { success: true, data: result, timestamp: new Date().toISOString() };
  }
}
