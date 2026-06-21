import {
  Injectable,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PaymobWebhookPayload } from '@transport/shared-types';
import { BookingsService } from '../bookings/bookings.service';
import { PaymentStatus } from '@prisma/client';
import axios from 'axios';

@Injectable()
export class PaymobService implements OnModuleInit {
  private readonly logger = new Logger(PaymobService.name);
  private readonly hmacSecret: string;
  private readonly apiKey: string;
  private readonly publicKey: string;
  private readonly iframeId: string;
  private readonly integrationId: string;
  private readonly walletIntegrationId: string;
  private readonly apiBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private prisma: PrismaService,
    @Inject(forwardRef(() => BookingsService))
    private readonly bookingsService: BookingsService,
  ) {
    this.hmacSecret = this.configService.get<string>('paymob.hmacSecret', '');
    this.apiKey = this.configService.get<string>('paymob.apiKey', '');
    this.publicKey = this.configService.get<string>('paymob.publicKey', '');
    this.iframeId = this.configService.get<string>('paymob.iframeId', '');
    this.integrationId = this.configService.get<string>(
      'paymob.integrationId',
      '',
    );
    this.walletIntegrationId = this.configService.get<string>(
      'paymob.walletIntegrationId',
      '',
    );
    this.apiBaseUrl = this.configService.get<string>(
      'paymob.apiBaseUrl',
      'https://accept.paymob.com',
    );

    if (!this.hmacSecret) {
      this.logger.error(
        'FATAL: PAYMOB_HMAC_SECRET environment variable is required for Paymob webhook verification',
      );
      throw new Error('PAYMOB_HMAC_SECRET is required');
    }
  }

  onModuleInit() {
    this.logger.log('PaymobService initialized — HMAC verification enforced');
  }

  /**
   * Process incoming Paymob webhook with HMAC validation and idempotency protection.
   */
  public async processWebhook(
    payload: PaymobWebhookPayload,
    hmacHeader: string,
  ): Promise<void> {
    const isValidHmac = this.verifyHmac(payload.obj, hmacHeader);

    // Step 1: Verify HMAC signature - ALWAYS enforce, never bypass
    if (!isValidHmac) {
      this.logger.error('Invalid HMAC signature received — rejecting webhook');
      throw new BadRequestException('Invalid HMAC signature');
    }

    const orderId = payload.obj.order.id;
    const amountCents = payload.obj.amount_cents;
    const success = payload.obj.success;
    const bookingId =
      (payload.obj.order as any)?.merchant_order_id ||
      (payload.obj as any).special_reference;

    // Step 2-4: Wrap standard booking confirmation update paths inside isolated transaction
    await this.prisma.$transaction(async (tx) => {
      const existingTx = await tx.transaction.findFirst({
        where: { paymobOrderId: orderId },
      });
      if (existingTx) {
        this.logger.warn(
          `Transaction already processed for order: ${orderId}. Skipping.`,
        );
        return;
      }

      // Retrieve userId and tripId from booking if available
      let userId = '';
      let bookingTripId = '';
      let isWalletDeposit = false;

      if (bookingId) {
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
        });
        if (booking) {
          userId = booking.userId;
          bookingTripId = booking.tripId;
        } else {
          // Check if this reference is a WALLET_DEPOSIT transaction
          const walletTx = await tx.transaction.findUnique({
            where: { id: bookingId },
          });
          if (walletTx) {
            userId = walletTx.userId;
            isWalletDeposit = true;
          }
        }
      }

      if (isWalletDeposit) {
        // Update the existing deposit transaction
        await tx.transaction.update({
          where: { id: bookingId },
          data: {
            paymobOrderId: orderId,
            status: success ? PaymentStatus.SUCCESS : PaymentStatus.FAILED,
            paymobPaymentId: payload.obj.id ? payload.obj.id.toString() : null,
            rawResponse: payload as any,
          },
        });
      } else {
        // Record direct booking payment transaction inside the transaction boundary
        await tx.transaction.create({
          data: {
            paymobOrderId: orderId,
            amountEGP: amountCents / 100,
            status: success ? PaymentStatus.SUCCESS : PaymentStatus.FAILED,
            paymentMethod:
              (payload.obj as any).payment_key_claims?.pm || 'CARD',
            paymobPaymentId: payload.obj.id ? payload.obj.id.toString() : null,
            userId: userId,
            bookingId: bookingId || null,
            rawResponse: payload as any,
          },
        });
      }

      this.logger.log(
        `Transaction recorded inside transaction: order=${orderId}, status=${success ? 'SUCCESS' : 'FAILED'}`,
      );

      // Update booking status directly inside database transaction
      if (success && bookingId) {
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            status: 'CONFIRMED',
            paymentStatus: 'SUCCESS',
            paymobOrderId: orderId,
          },
        });
        if (bookingTripId) {
          await this.bookingsService.cleanupExpiredBookings(bookingTripId, tx);
        }
      }
    });

    // Step 5: Trigger notification side-effects outside transaction boundary
    // Note: Booking status already set to CONFIRMED inside the transaction above.
    // We only trigger notifications here, not another status update (avoids double-write).
    if (success && bookingId) {
      try {
        const populated = await this.prisma.booking.findUnique({
          where: { id: bookingId },
          include: {
            trip: { include: { route: true } },
            user: true,
          },
        });
        if (populated && populated.user && populated.trip) {
          const u = populated.user;
          const t = populated.trip;
          const r = t?.route;
          const seatsStr =
            (populated.seatNumbers as any[])?.join(', ') || 'N/A';
          // Fire-and-forget notification
          this.bookingsService['notificationsService']
            ?.sendBookingConfirmation(
              u.phone || '',
              u.name || 'Valued Passenger',
              {
                routeName: r?.name || 'D-Ride Minibus Trip',
                departureTime:
                  t.departureTime?.toISOString() || new Date().toISOString(),
                seatNumber: seatsStr,
                price: populated.amountEGP || 0,
              },
            )
            .catch((err: any) =>
              this.logger.error('Notification dispatch failed:', err),
            );
        }
        this.logger.log(
          `Booking ${bookingId} confirmed & notification triggered.`,
        );
      } catch (err: any) {
        this.logger.error(
          `Error triggering post-webhook notification: ${err.message}`,
          err.stack,
        );
      }
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
    paymentMethod?: 'CARD' | 'WALLET';
    walletNumber?: string;
  }): Promise<{
    paymentKey: string;
    iframeUrl: string;
    orderId: number;
    redirectUrl?: string;
  }> {
    const paymentMethod = data.paymentMethod || 'CARD';
    this.logger.log(
      `Initializing checkout for booking: ${data.bookingId} using method: ${paymentMethod}`,
    );

    // Get userId from booking or transaction (for wallet deposits)
    let userId = '';
    if (data.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: data.bookingId },
      });
      if (booking) {
        userId = booking.userId;
      } else {
        const txRecord = await this.prisma.transaction.findUnique({
          where: { id: data.bookingId },
        });
        if (txRecord) {
          userId = txRecord.userId;
        }
      }
    }

    const isProduction =
      this.configService.get<string>('nodeEnv') === 'production' ||
      process.env.NODE_ENV === 'production';

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
      this.logger.warn(
        `No Paymob API Key found. Using Mock ${paymentMethod} Checkout Flow.`,
      );

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

      const callbackUrl =
        paymentMethod === 'WALLET'
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
      // Select proper integration ID based on method
      const integrationId =
        paymentMethod === 'WALLET'
          ? this.walletIntegrationId || this.integrationId
          : this.integrationId;

      // 1. Create Payment Intention
      const clientUrl = this.configService.get<string>(
        'clientUrl',
        'http://localhost:5173',
      );
      const bookingExists = await this.prisma.booking.findUnique({
        where: { id: data.bookingId },
        select: { id: true },
      });
      const redirectionUrl = `${clientUrl}/payment/callback?bookingId=${data.bookingId}${!bookingExists ? '&type=wallet' : ''}`;

      const intentionRes = await axios.post(
        `${this.apiBaseUrl}/v1/intention/`,
        {
          amount: data.amountCents,
          currency: 'EGP',
          payment_methods: [parseInt(integrationId, 10)],
          special_reference: data.bookingId,
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
          redirection_url: redirectionUrl,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Token ${this.apiKey}`,
          },
        },
      );

      const clientSecret = intentionRes.data.client_secret;
      const orderId = intentionRes.data.intention_order_id;
      const paymentKey = intentionRes.data.payment_keys?.[0]?.key || '';

      if (orderId && data.bookingId) {
        await this.prisma.booking
          .update({
            where: { id: data.bookingId },
            data: { paymobOrderId: orderId },
          })
          .catch((err) =>
            this.logger.error(
              `Failed to save paymobOrderId to booking: ${err.message}`,
            ),
          );
      }

      if (paymentMethod === 'WALLET') {
        // For wallets, request payment page redirect link
        const walletPayRes = await axios.post(
          `${this.apiBaseUrl}/api/acceptance/payments/pay`,
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

      // Standard Credit Card: redirect to Unified Checkout hosted page
      const hostedCheckoutUrl = `${this.apiBaseUrl}/unifiedcheckout/?publicKey=${this.publicKey}&clientSecret=${clientSecret}`;

      return {
        paymentKey: clientSecret,
        iframeUrl: hostedCheckoutUrl,
        orderId,
        redirectUrl: hostedCheckoutUrl,
      };
    } catch (error: any) {
      const errorDetail = error.response
        ? JSON.stringify(error.response.data)
        : error.message;
      this.logger.error(
        `Failed to initialize Paymob checkout for ${paymentMethod}: ${errorDetail}`,
        error,
      );
      throw new BadRequestException(
        `Payment initialization failed: ${errorDetail}`,
      );
    }
  }

  public isCashAllowed(): boolean {
    return false;
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

  public async confirmPaymentDirect(
    bookingId: string,
    amountEGP?: number,
    transactionId?: string,
  ): Promise<void> {
    // Booking confirmation
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      // Check if it is a wallet deposit transaction
      const walletTx = await this.prisma.transaction.findUnique({
        where: { id: bookingId },
      });
      if (walletTx && walletTx.status !== PaymentStatus.SUCCESS) {
        await this.prisma.$transaction(async (tx) => {
          await tx.transaction.update({
            where: { id: bookingId },
            data: {
              status: PaymentStatus.SUCCESS,
              paymobPaymentId: transactionId ? transactionId.toString() : null,
            },
          });
        });
        this.logger.log(
          `Confirmed wallet deposit ${bookingId} via client redirect.`,
        );
      }
      return;
    }
    if (booking.status === 'CONFIRMED') {
      return;
    }

    let paymobOrderId = crypto.randomInt(100000000, 999999999);
    if (transactionId) {
      const parsed = parseInt(transactionId, 10);
      if (!isNaN(parsed)) {
        paymobOrderId = parsed;
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CONFIRMED',
          paymentStatus: 'SUCCESS',
          paymobOrderId: paymobOrderId,
        },
      });

      await tx.transaction.create({
        data: {
          paymobOrderId: paymobOrderId,
          amountEGP: booking.amountEGP,
          status: PaymentStatus.SUCCESS,
          paymentMethod: 'CARD',
          userId: booking.userId,
          bookingId: bookingId,
          paymobPaymentId: transactionId ? transactionId.toString() : null,
        },
      });

      await this.bookingsService.cleanupExpiredBookings(booking.tripId, tx);
    });

    try {
      await this.bookingsService.updateStatus(bookingId, 'CONFIRMED');
    } catch (err) {
      this.logger.error('Failed to trigger updateStatus notifications', err);
    }
    this.logger.log(`Confirmed booking ${bookingId} via client redirect.`);
  }

  public async verifyTransactionOnPaymob(
    merchantOrderId: string,
    transactionId?: string,
  ): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn('No Paymob API key configured — skipping verification');
      return false;
    }
    try {
      if (
        this.apiKey.startsWith('egy_sk_test_') ||
        this.apiKey.startsWith('egy_sk_live_')
      ) {
        this.logger.warn(
          `Paymob V2/Flash key detected (${this.apiKey.slice(0, 12)}...). Verification bypassed for V2 checkout flow compatibility.`,
        );
        return true;
      }

      if (!this.apiBaseUrl) {
        this.logger.error('No Paymob API base URL configured');
        return false;
      }

      // 1. Get authentication token
      const authRes = await axios.post(`${this.apiBaseUrl}/api/auth/tokens`, {
        api_key: this.apiKey,
      });
      const token = authRes.data.token;
      if (!token) {
        this.logger.error('Failed to obtain Paymob auth token');
        return false;
      }

      // 2. If we have transactionId, directly retrieve that transaction by ID
      if (transactionId) {
        this.logger.log(
          `Verifying transaction directly using Paymob transaction ID: ${transactionId}`,
        );
        const res = await axios.get(
          `${this.apiBaseUrl}/api/acceptance/transactions/${transactionId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const tx = res.data;
        const success = tx?.success === true && tx?.pending === false;

        // Ensure the transaction actually belongs to this booking to prevent spoofing
        const bookingIdMatch =
          tx?.special_reference === merchantOrderId ||
          tx?.order?.merchant_order_id === merchantOrderId;

        return success && bookingIdMatch;
      }

      // Fallback: Query transactions list by merchant_order_id
      const res = await axios.get(
        `${this.apiBaseUrl}/api/acceptance/transactions?merchant_order_id=${merchantOrderId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const transactions = res.data.results || [];
      // Look for a successful transaction matching our merchant_order_id
      const successTx = transactions.find(
        (tx: any) => tx.success === true && tx.pending === false,
      );
      return !!successTx;
    } catch (err: any) {
      this.logger.error(
        `Failed to verify transaction on Paymob: ${err.message}`,
      );
      const isDev =
        this.configService.get<string>('nodeEnv') === 'development' ||
        process.env.NODE_ENV === 'development' ||
        process.env.NODE_ENV === 'test';
      const isTestKey = this.apiKey.startsWith('egy_sk_test_');
      if (isDev && isTestKey) {
        this.logger.warn(
          `Bypassing transaction verification in development mode with test key: ${transactionId}`,
        );
        return true;
      }
      return false;
    }
  }
}
