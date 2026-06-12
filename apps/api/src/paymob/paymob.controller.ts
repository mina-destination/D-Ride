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
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';

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
  async initializeCheckout(
    @Request() req: any,
    @Body() data: InitializeCheckoutDto,
  ) {
    // Verify the authenticated user owns the booking
    const booking = await this.prisma.booking.findUnique({
      where: { id: data.bookingId },
    });
    if (booking && booking.userId !== req.user.sub) {
      throw new ForbiddenException('You do not own this booking');
    }
    this.logger.log(`Initializing checkout for booking: ${data.bookingId}`);
    const result = await this.paymobService.initializeCheckout(data);
    return { success: true, data: result, timestamp: new Date().toISOString() };
  }

  @UseGuards(JwtAuthGuard)
  @Post('confirm')
  async confirmPayment(@Request() req: any, @Body() body: ConfirmPaymentDto) {
    this.logger.log(
      `Direct confirmation request for: ${body.bookingId}, success: ${body.success}`,
    );
    // Verify ownership
    if (body.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: body.bookingId },
      });
      if (booking && booking.userId !== req.user.sub) {
        throw new ForbiddenException('You do not own this booking');
      }
    }
    if (body.success && body.bookingId) {
      // If already confirmed in our DB, return success immediately (happy path)
      const booking = await this.prisma.booking.findUnique({
        where: { id: body.bookingId },
      });
      if (booking && booking.status === 'CONFIRMED') {
        return { success: true };
      }

      // 2. Perform server-side validation against Paymob API to prevent spoofing
      const isValid = await this.paymobService.verifyTransactionOnPaymob(
        body.bookingId,
        body.transactionId,
      );
      if (!isValid) {
        throw new ForbiddenException('Payment verification failed on Paymob');
      }

      await this.paymobService.confirmPaymentDirect(
        body.bookingId,
        body.amount,
        body.transactionId,
      );
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

}
