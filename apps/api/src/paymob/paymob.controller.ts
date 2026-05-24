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
} from '@nestjs/common';
import { PaymobService } from './paymob.service';
import { InitializeCheckoutDto } from './dto/initialize-checkout.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('paymob')
export class PaymobController {
  private readonly logger = new Logger(PaymobController.name);

  constructor(private readonly paymobService: PaymobService) {}

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

  @Post('checkout')
  async initializeCheckout(@Body() data: InitializeCheckoutDto) {
    this.logger.log(`Initializing checkout for booking: ${data.bookingId}`);
    const result = await this.paymobService.initializeCheckout(data);
    return { success: true, data: result, timestamp: new Date().toISOString() };
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
