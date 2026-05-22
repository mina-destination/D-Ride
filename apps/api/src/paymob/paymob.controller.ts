import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PaymobService } from './paymob.service';
import { InitializeCheckoutDto } from './dto/initialize-checkout.dto';

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
}
