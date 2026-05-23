import {
  Injectable,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PaymobWebhookPayload } from '@transport/shared-types';
import { BookingsService } from '../bookings/bookings.service';
import { PaymentStatus } from '@prisma/client';
import axios from 'axios';

@Injectable()
export class PaymobService {
  private readonly logger = new Logger(PaymobService.name);
  private readonly hmacSecret: string;
  private readonly apiKey: string;
  private readonly iframeId: string;
  private readonly integrationId: string;
  private readonly walletIntegrationId: string;

  constructor(
    private readonly configService: ConfigService,
    private prisma: PrismaService,
    @Inject(forwardRef(() => BookingsService))
    private readonly bookingsService: BookingsService,
  ) {
    this.hmacSecret = this.configService.get<string>('paymob.hmacSecret', '');
    this.apiKey = this.configService.get<string>('paymob.apiKey', '');
    this.iframeId = this.configService.get<string>('paymob.iframeId', '');
    this.integrationId = this.configService.get<string>(
      'paymob.integrationId',
      '',
    );
    this.walletIntegrationId = this.configService.get<string>(
      'paymob.walletIntegrationId',
      '',
    );
  }

  /**
   * Process incoming Paymob webhook with HMAC validation and idempotency protection.
   */
  public async processWebhook(
    payload: PaymobWebhookPayload,
    hmacHeader: string,
  ): Promise<void> {
    const isProduction =
      this.configService.get<string>('nodeEnv') === 'production';
    const isValidHmac = this.verifyHmac(payload.obj, hmacHeader);

    // Step 1: Verify HMAC signature
    if (!isValidHmac) {
      if (isProduction) {
        this.logger.error(
          'Invalid HMAC signature received in production environment!',
        );
        throw new BadRequestException('Invalid HMAC signature');
      }
      if (this.apiKey) {
        this.logger.error(
          'Invalid HMAC signature received (API Key is configured)',
        );
        throw new BadRequestException('Invalid HMAC signature');
      }
      this.logger.warn(
        'HMAC verification failed, but bypassing due to development/sandbox mode.',
      );
    }

    const orderId = payload.obj.order.id;
    const amountCents = payload.obj.amount_cents;
    const success = payload.obj.success;
    const bookingId = (payload.obj.order as any).merchant_order_id; // we passed bookingId here

    // Step 2: Idempotency lock — prevent race conditions and double-charging
    const existingTx = await this.prisma.transaction.findFirst({
      where: { paymobOrderId: orderId },
    });
    if (existingTx) {
      this.logger.warn(
        `Transaction already processed for order: ${orderId}. Skipping.`,
      );
      return;
    }

    // Retrieve userId from booking if available
    let userId = '';
    if (bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
      });
      if (booking) {
        userId = booking.userId;
      }
    }

    // Step 3: Record the transaction
    await this.prisma.transaction.create({
      data: {
        paymobOrderId: orderId,
        amountEGP: amountCents / 100,
        status: success ? PaymentStatus.SUCCESS : PaymentStatus.FAILED,
        paymentMethod: (payload.obj as any).payment_key_claims?.pm || 'CARD',
        paymobPaymentId: payload.obj.id ? payload.obj.id.toString() : null,
        userId: userId,
        bookingId: bookingId || null,
        rawResponse: payload as any,
      },
    });

    this.logger.log(
      `Transaction recorded: order=${orderId}, status=${success ? 'SUCCESS' : 'FAILED'}`,
    );

    // Step 4: Update booking status
    if (success && bookingId) {
      await this.bookingsService.updateStatus(bookingId, 'CONFIRMED');
      this.logger.log(`Booking ${bookingId} confirmed.`);
    }
  }

  /**
   * Initialize a Paymob HTML5 Unified Checkout session.
   * Returns the payment key and iframe URL for client-side rendering.
   */
  public async initializeCheckout(data: {
    bookingId: string;
    amountCents: number;
    billingData?: any;
    paymentMethod?: 'CARD' | 'WALLET' | 'CASH';
    walletNumber?: string;
  }): Promise<{ paymentKey: string; iframeUrl: string; orderId: number; redirectUrl?: string }> {
    const paymentMethod = data.paymentMethod || 'CARD';
    this.logger.log(
      `Initializing checkout for booking: ${data.bookingId} using method: ${paymentMethod}`,
    );

    // Get userId from booking
    const booking = await this.prisma.booking.findUnique({
      where: { id: data.bookingId },
    });
    const userId = booking ? booking.userId : '';

    // Handle Cash on Board Directly
    if (paymentMethod === 'CASH') {
      this.logger.log(`Cash booking selected. Direct confirmation for booking ${data.bookingId}`);
      await this.bookingsService.updateStatus(data.bookingId, 'CONFIRMED');
      
      // Save direct mock success transaction
      await this.prisma.transaction.create({
        data: {
          paymobOrderId: Math.floor(Math.random() * 1000000),
          amountEGP: data.amountCents / 100,
          status: PaymentStatus.SUCCESS,
          paymentMethod: 'CASH',
          userId: userId,
          bookingId: data.bookingId,
        },
      });

      return {
        paymentKey: 'cash',
        iframeUrl: `/payment/callback?success=true&method=cash`,
        orderId: 0,
      };
    }

    const isProduction =
      this.configService.get<string>('nodeEnv') === 'production';

    if (!this.apiKey) {
      if (isProduction) {
        this.logger.error(
          'PAYMOB_API_KEY is not configured in production environment!',
        );
        throw new BadRequestException(
          'Payment initialization failed: Payment gateway misconfigured.',
        );
      }

      // Sandbox / Mock Mode
      this.logger.warn(`No Paymob API Key found. Using Mock ${paymentMethod} Checkout Flow.`);

      const mockOrderId = Math.floor(Math.random() * 1000000);
      const mockPaymentKey = `pk_test_${Date.now()}`;

      // Simulate webhook event asynchronously
      setTimeout(() => {
        this.processWebhook(
          {
            obj: {
              order: { id: mockOrderId, merchant_order_id: data.bookingId },
              amount_cents: data.amountCents,
              success: true,
            } as any,
          } as any,
          '',
        ).catch(console.error);
      }, 1000);

      const callbackUrl = paymentMethod === 'WALLET'
        ? `/payment/callback?success=true&order=${mockOrderId}&method=wallet&wallet=${data.walletNumber || '01000000000'}`
        : `/payment/callback?success=true&order=${mockOrderId}&method=card`;

      return {
        paymentKey: mockPaymentKey,
        iframeUrl: callbackUrl,
        orderId: mockOrderId,
        redirectUrl: callbackUrl,
      };
    }

    // Actual Paymob Flow
    try {
      // 1. Authenticate
      const authRes = await axios.post(
        'https://accept.paymob.com/api/auth/tokens',
        {
          api_key: this.apiKey,
        },
      );
      const token = authRes.data.token;

      // 2. Register Order
      const orderRes = await axios.post(
        'https://accept.paymob.com/api/ecommerce/orders',
        {
          auth_token: token,
          delivery_needed: 'false',
          amount_cents: data.amountCents,
          currency: 'EGP',
          merchant_order_id: data.bookingId,
          items: [],
        },
      );
      const orderId = orderRes.data.id;

      // Select proper integration ID based on method
      const integrationId = paymentMethod === 'WALLET'
        ? (this.walletIntegrationId || this.integrationId)
        : this.integrationId;

      // 3. Request Payment Key
      const keyRes = await axios.post(
        'https://accept.paymob.com/api/acceptance/payment_keys',
        {
          auth_token: token,
          amount_cents: data.amountCents,
          expiration: 3600,
          order_id: orderId,
          billing_data: data.billingData || {
            apartment: 'NA',
            email: 'passenger@dride.com',
            floor: 'NA',
            first_name: 'John',
            street: 'NA',
            building: 'NA',
            phone_number: data.walletNumber || '+201000000000',
            shipping_method: 'NA',
            postal_code: 'NA',
            city: 'Cairo',
            country: 'EG',
            last_name: 'Doe',
            state: 'NA',
          },
          currency: 'EGP',
          integration_id: integrationId,
          lock_order_when_paid: 'false',
        },
      );

      const paymentKey = keyRes.data.token;

      if (paymentMethod === 'WALLET') {
        // For wallets, request payment page redirect link
        const walletPayRes = await axios.post(
          'https://accept.paymob.com/api/acceptance/payments/pay',
          {
            source: {
              identifier: data.walletNumber || '01000000000',
              subtype: 'WALLET',
            },
            payment_token: paymentKey,
          },
        );
        const redirectUrl =
          walletPayRes.data.iframe_redirection_url ||
          walletPayRes.data.redirect_url;

        return {
          paymentKey,
          iframeUrl: redirectUrl,
          orderId,
          redirectUrl,
        };
      }

      // Standard Credit Card IFrame
      return {
        paymentKey,
        iframeUrl: `https://accept.paymob.com/api/acceptance/iframes/${this.iframeId}?payment_token=${paymentKey}`,
        orderId,
      };
    } catch (error) {
      this.logger.error(`Failed to initialize Paymob checkout for ${paymentMethod}`, error);
      throw new BadRequestException('Payment initialization failed');
    }
  }

  /**
   * Verify the HMAC-SHA512 signature from Paymob webhook.
   * Uses the lexicographic concatenation of transaction fields as specified by Paymob docs.
   */
  private verifyHmac(obj: any, hmacHeader: string): boolean {
    if (!this.hmacSecret || !hmacHeader) {
      this.logger.warn('HMAC verification skipped: missing secret or header');
      return false;
    }

    const {
      amount_cents,
      created_at,
      currency,
      error_occured,
      has_parent_transaction,
      id,
      integration_id,
      is_3d_secure,
      is_auth,
      is_capture,
      is_refunded,
      is_standalone_payment,
      is_voided,
      order,
      owner,
      pending,
      source_data,
      success,
    } = obj;

    const lexographicalString = [
      amount_cents,
      created_at,
      currency,
      error_occured,
      has_parent_transaction,
      id,
      integration_id,
      is_3d_secure,
      is_auth,
      is_capture,
      is_refunded,
      is_standalone_payment,
      is_voided,
      order.id,
      owner,
      pending,
      source_data.pan,
      source_data.sub_type,
      source_data.type,
      success,
    ].join('');

    const calculatedHmac = crypto
      .createHmac('sha512', this.hmacSecret)
      .update(lexographicalString)
      .digest('hex');

    return calculatedHmac === hmacHeader;
  }
}
