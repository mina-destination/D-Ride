import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { MailService } from './mail.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger('NotificationsService');
  private twilioClient: Twilio | null = null;
  private twilioPhone = '';
  private twilioWhatsApp = '';
  private isTwilioConfigured = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly whatsappService: WhatsappService,
  ) {}

  onModuleInit() {
    const accountSid = this.configService.get<string>('twilio.accountSid');
    const authToken = this.configService.get<string>('twilio.authToken');
    this.twilioPhone =
      this.configService.get<string>('twilio.phoneNumber') || '';
    this.twilioWhatsApp =
      this.configService.get<string>('twilio.whatsappNumber') || '';

    if (
      accountSid &&
      accountSid.startsWith('AC') &&
      authToken &&
      this.twilioPhone
    ) {
      try {
        this.twilioClient = new Twilio(accountSid, authToken);
        this.isTwilioConfigured = true;
        this.logger.log(
          'Twilio client successfully initialized for notifications.',
        );
      } catch (err) {
        this.logger.error(
          'Failed to initialize Twilio client, falling back to mock logs.',
          err,
        );
      }
    } else {
      this.logger.warn(
        'Twilio credentials or sender phone number are missing or invalid (must start with AC). Running notifications in fallback MOCK mode (stdout).',
      );
    }
  }

  private validatePhoneNumber(phone: string): boolean {
    const e164Regex = /^\+?[1-9]\d{6,14}$/;
    return e164Regex.test(phone);
  }

  /**
   * Dispatches an SMS message.
   */
  async sendSMS(to: string, message: string): Promise<boolean> {
    const formattedTo = to.startsWith('+') ? to : `+20${to}`; // Default to Egypt country code
    if (!this.validatePhoneNumber(formattedTo)) {
      this.logger.warn(
        `Invalid phone number format: ${to}. Skipping SMS dispatch.`,
      );
      return false;
    }

    if (this.isTwilioConfigured && this.twilioClient) {
      try {
        await this.twilioClient.messages.create({
          body: message,
          from: this.twilioPhone,
          to: formattedTo,
        });
        this.logger.log(
          `SMS successfully dispatched via Twilio to ${formattedTo}`,
        );
        return true;
      } catch (error) {
        this.logger.error(`Failed to send Twilio SMS to ${to}`, error);
        this.logMockMessage('SMS [FAILED FALLBACK]', to, message);
        return false;
      }
    } else {
      this.logMockMessage('SMS (Mock)', to, message);
      return true;
    }
  }

  async sendWhatsApp(to: string, message: string): Promise<boolean> {
    const formattedTo = to.startsWith('+') ? to : `+20${to}`; // Default to Egypt country code
    if (!this.validatePhoneNumber(formattedTo)) {
      this.logger.warn(
        `Invalid phone number format: ${to}. Skipping WhatsApp dispatch.`,
      );
      return false;
    }

    // Attempt dispatch via OpenWA WhatsappService first
    const sentViaOpenWA = await this.whatsappService.sendWhatsAppMessage(
      to,
      message,
    );
    if (sentViaOpenWA) {
      return true;
    }

    if (this.isTwilioConfigured && this.twilioClient && this.twilioWhatsApp) {
      try {
        await this.twilioClient.messages.create({
          body: message,
          from: `whatsapp:${this.twilioWhatsApp}`,
          to: `whatsapp:${formattedTo}`,
        });
        this.logger.log(
          `WhatsApp successfully dispatched via Twilio to ${formattedTo}`,
        );
        return true;
      } catch (error) {
        this.logger.error(`Failed to send Twilio WhatsApp to ${to}`, error);
        this.logMockMessage('WhatsApp [FAILED FALLBACK]', to, message);
        return false;
      }
    } else {
      this.logMockMessage('WhatsApp (Mock)', to, message);
      return true;
    }
  }

  /**
   * Sends a structured booking confirmation receipt.
   */
  async sendBookingConfirmation(
    to: string,
    passengerName: string,
    tripDetails: {
      routeName: string;
      departureTime: string;
      seatNumber: string;
      price: number;
    },
    email?: string,
  ): Promise<void> {
    const formattedDate = new Date(tripDetails.departureTime).toLocaleString(
      'en-US',
      {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
    );

    const smsMessage =
      `Hi ${passengerName}, your D-Ride ticket is confirmed!\n\n` +
      `Route: ${tripDetails.routeName}\n` +
      `Time: ${formattedDate}\n` +
      `Seat: ${tripDetails.seatNumber}\n` +
      `Amount paid: EGP ${tripDetails.price.toFixed(2)}\n\n` +
      `Show your QR code on board. Have a safe trip!`;

    const whatsappMessage =
      `*D-Ride Ticket Confirmation* 🎫\n\n` +
      `Dear *${passengerName}*,\n` +
      `Your booking has been successfully confirmed. Here are your trip details:\n\n` +
      `📍 *Route:* ${tripDetails.routeName}\n` +
      `⏰ *Departure:* ${formattedDate}\n` +
      `💺 *Seat Number:* ${tripDetails.seatNumber}\n` +
      `💵 *Fare Paid:* EGP ${tripDetails.price.toFixed(2)}\n\n` +
      `Please present your boarding pass QR code to the driver upon boarding.\n` +
      `*Thank you for riding with D-Ride!* 🚌`;

    // Send SMS and WhatsApp for maximum visibility
    await this.sendSMS(to, smsMessage);
    await this.sendWhatsApp(to, whatsappMessage);

    // Dispatch email if provided
    if (email) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px; background-color: #0e0e1b; color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #f5b731; margin: 0;">D-Ride Ticket Confirmation 🎫</h2>
          </div>
          <p>Dear ${passengerName},</p>
          <p>Your booking has been successfully confirmed. Here are your trip details:</p>
          <div style="margin: 24px 0; padding: 16px; background-color: #14142b; border-left: 4px solid #f5b731; border-radius: 4px;">
            <p style="margin: 4px 0;">📍 <strong>Route:</strong> ${tripDetails.routeName}</p>
            <p style="margin: 4px 0;">⏰ <strong>Departure:</strong> ${formattedDate}</p>
            <p style="margin: 4px 0;">💺 <strong>Seat Number:</strong> ${tripDetails.seatNumber}</p>
            <p style="margin: 4px 0;">💵 <strong>Fare Paid:</strong> EGP ${tripDetails.price.toFixed(2)}</p>
          </div>
          <p style="font-size: 13px; color: #a3a3a3;">Please present your boarding pass QR code in your dashboard to the driver upon boarding.</p>
          <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 24px 0;" />
          <p style="font-size: 11px; color: #737373; text-align: center;">D-Ride Operations Team &copy; 2026. Have a safe trip!</p>
        </div>
      `;
      const emailText =
        `Dear ${passengerName},\n\n` +
        `Your booking has been successfully confirmed. Here are your trip details:\n\n` +
        `Route: ${tripDetails.routeName}\n` +
        `Departure: ${formattedDate}\n` +
        `Seat Number: ${tripDetails.seatNumber}\n` +
        `Fare Paid: EGP ${tripDetails.price.toFixed(2)}\n\n` +
        `Have a safe trip!\n\nD-Ride Operations Team`;

      await this.mailService.sendMail(
        email,
        `D-Ride Booking Confirmation — ${tripDetails.routeName}`,
        emailText,
        emailHtml,
      );
    }
  }

  /**
   * Sends a cancellation notification to the passenger.
   */
  async sendCancellationNotification(
    to: string,
    passengerName: string,
    tripDetails: {
      routeName: string;
      departureTime: string;
      seatNumber: string;
      price: number;
    },
    email?: string,
    cancelledBy: 'PASSENGER' | 'SYSTEM' = 'PASSENGER',
  ): Promise<void> {
    const formattedDate = new Date(tripDetails.departureTime).toLocaleString(
      'en-US',
      {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
    );

    const initiatorText =
      cancelledBy === 'PASSENGER'
        ? 'You have successfully cancelled your booking.'
        : 'Your booking has been cancelled by D-Ride due to route schedule updates or emergency.';

    const smsMessage =
      `Hi ${passengerName}, your D-Ride ticket has been cancelled.\n\n` +
      `Route: ${tripDetails.routeName}\n` +
      `Time: ${formattedDate}\n` +
      `Refund details will be processed shortly.`;

    const whatsappMessage =
      `*D-Ride Ticket Cancellation* ❌\n\n` +
      `Dear *${passengerName}*,\n` +
      `${initiatorText} Here are the details of the cancelled trip:\n\n` +
      `📍 *Route:* ${tripDetails.routeName}\n` +
      `⏰ *Departure:* ${formattedDate}\n` +
      `💺 *Seat Number:* ${tripDetails.seatNumber}\n` +
      `💵 *Original Fare:* EGP ${tripDetails.price.toFixed(2)}\n\n` +
      `If a refund is applicable, it will be credited/processed shortly based on cancellation policies.\n` +
      `*Thank you for choosing D-Ride!* 🚌`;

    // Send SMS and WhatsApp for maximum visibility
    await this.sendSMS(to, smsMessage);
    await this.sendWhatsApp(to, whatsappMessage);

    // Dispatch email if provided
    if (email) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px; background-color: #0e0e1b; color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #EF4444; margin: 0;">D-Ride Ticket Cancellation ❌</h2>
          </div>
          <p>Dear ${passengerName},</p>
          <p>${initiatorText}</p>
          <div style="margin: 24px 0; padding: 16px; background-color: #14142b; border-left: 4px solid #EF4444; border-radius: 4px;">
            <p style="margin: 4px 0;">📍 <strong>Route:</strong> ${tripDetails.routeName}</p>
            <p style="margin: 4px 0;">⏰ <strong>Departure:</strong> ${formattedDate}</p>
            <p style="margin: 4px 0;">💺 <strong>Seat Number:</strong> ${tripDetails.seatNumber}</p>
            <p style="margin: 4px 0;">💵 <strong>Original Fare:</strong> EGP ${tripDetails.price.toFixed(2)}</p>
          </div>
          <p style="font-size: 13px; color: #a3a3a3;">Refunds (if applicable) are processed within 24 hours based on our cancellation policies.</p>
          <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 24px 0;" />
          <p style="font-size: 11px; color: #737373; text-align: center;">D-Ride Operations Team &copy; 2026. If you have questions, contact support.</p>
        </div>
      `;
      const emailText =
        `Dear ${passengerName},\n\n` +
        `${initiatorText}\n\n` +
        `Route: ${tripDetails.routeName}\n` +
        `Departure: ${formattedDate}\n` +
        `Seat Number: ${tripDetails.seatNumber}\n` +
        `Original Fare: EGP ${tripDetails.price.toFixed(2)}\n\n` +
        `Refunds (if applicable) are processed shortly.\n\nD-Ride Operations Team`;

      await this.mailService.sendMail(
        email,
        `D-Ride Booking Cancellation — ${tripDetails.routeName}`,
        emailText,
        emailHtml,
      );
    }
  }

  /**
   * Sends a refund notification to the passenger.
   */
  async sendRefundNotification(
    to: string,
    passengerName: string,
    refundDetails: {
      routeName: string;
      departureTime: string;
      originalAmount: number;
      refundAmount: number;
      percentage: number;
      reason: string;
    },
    email?: string,
  ): Promise<void> {
    const formattedDate = new Date(refundDetails.departureTime).toLocaleString(
      'en-US',
      {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
    );

    let statusText = '';
    if (refundDetails.percentage === 100) {
      statusText = `approved for 100% full refund (EGP ${refundDetails.refundAmount.toFixed(2)})`;
    } else if (refundDetails.percentage === 50) {
      statusText = `approved for 50% partial refund (EGP ${refundDetails.refundAmount.toFixed(2)})`;
    } else {
      statusText = `rejected (no refund)`;
    }

    const smsMessage =
      `Hi ${passengerName}, your refund request for trip (${refundDetails.routeName} on ${formattedDate}) has been ${statusText}.\n\n` +
      `Policy Reason: ${refundDetails.reason}.\n` +
      `Thank you for using D-Ride!`;

    const whatsappMessage =
      `*D-Ride Refund Status Update* 💵\n\n` +
      `Dear *${passengerName}*,\n` +
      `Your refund request for the following booking has been processed:\n\n` +
      `📍 *Route:* ${refundDetails.routeName}\n` +
      `⏰ *Departure:* ${formattedDate}\n` +
      `💰 *Original Amount:* EGP ${refundDetails.originalAmount.toFixed(2)}\n` +
      `💸 *Refund Amount:* EGP ${refundDetails.refundAmount.toFixed(2)} (${refundDetails.percentage}%)\n` +
      `📝 *Status:* ${statusText.toUpperCase()}\n` +
      `📋 *Reason:* ${refundDetails.reason}\n\n` +
      `*Thank you for choosing D-Ride!* 🚌`;

    await this.sendSMS(to, smsMessage);
    await this.sendWhatsApp(to, whatsappMessage);

    // Dispatch email if provided
    if (email) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px; background-color: #0e0e1b; color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #f5b731; margin: 0;">D-Ride Cancellation & Refund Update 💵</h2>
          </div>
          <p>Dear ${passengerName},</p>
          <p>Your booking has been cancelled and a refund has been processed. Here are the details:</p>
          <div style="margin: 24px 0; padding: 16px; background-color: #14142b; border-left: 4px solid #f5b731; border-radius: 4px;">
            <p style="margin: 4px 0;">📍 <strong>Route:</strong> ${refundDetails.routeName}</p>
            <p style="margin: 4px 0;">⏰ <strong>Departure:</strong> ${formattedDate}</p>
            <p style="margin: 4px 0;">💵 <strong>Original Fare:</strong> EGP ${refundDetails.originalAmount.toFixed(2)}</p>
            <p style="margin: 4px 0;">💸 <strong>Refund Amount:</strong> EGP ${refundDetails.refundAmount.toFixed(2)} (${refundDetails.percentage}%)</p>
            <p style="margin: 4px 0;">📝 <strong>Status:</strong> ${statusText.toUpperCase()}</p>
            <p style="margin: 4px 0;">📋 <strong>Reason:</strong> ${refundDetails.reason}</p>
          </div>
          <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 24px 0;" />
          <p style="font-size: 11px; color: #737373; text-align: center;">D-Ride Operations Team &copy; 2026.</p>
        </div>
      `;
      const emailText =
        `Dear ${passengerName},\n\n` +
        `Your booking has been cancelled and a refund has been processed.\n\n` +
        `Route: ${refundDetails.routeName}\n` +
        `Departure: ${formattedDate}\n` +
        `Original Fare: EGP ${refundDetails.originalAmount.toFixed(2)}\n` +
        `Refund Amount: EGP ${refundDetails.refundAmount.toFixed(2)} (${refundDetails.percentage}%)\n` +
        `Status: ${statusText.toUpperCase()}\n` +
        `Reason: ${refundDetails.reason}\n\n` +
        `D-Ride Operations Team`;

      await this.mailService.sendMail(
        email,
        `D-Ride Booking Cancellation & Refund — ${refundDetails.routeName}`,
        emailText,
        emailHtml,
      );
    }
  }

  /**
   * Logs a beautifully formatted terminal box containing the mock message.
   */
  private logMockMessage(channel: string, to: string, message: string) {
    const border = '═'.repeat(60);
    const time = new Date().toLocaleTimeString();

    console.log(`
╔${border}╗
║ 📡  NOTIFICATION CHANNEL: ${channel.padEnd(33)} ║
║ 🕒  TIME: ${time.padEnd(49)} ║
║ 📱  RECIPIENT: ${to.padEnd(44)} ║
╠${border}╣
${message
  .split('\n')
  .map((line) => `║ ${line.padEnd(58)} ║`)
  .join('\n')}
╚${border}╝
`);
  }
}
