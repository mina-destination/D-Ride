import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger('NotificationsService');
  private twilioClient: Twilio | null = null;
  private twilioPhone = '';
  private twilioWhatsApp = '';
  private isTwilioConfigured = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const accountSid = this.configService.get<string>('twilio.accountSid');
    const authToken = this.configService.get<string>('twilio.authToken');
    this.twilioPhone =
      this.configService.get<string>('twilio.phoneNumber') || '';
    this.twilioWhatsApp =
      this.configService.get<string>('twilio.whatsappNumber') || '';

    if (accountSid && authToken && this.twilioPhone) {
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
        'Twilio credentials or sender phone number are missing. Running notifications in fallback MOCK mode (stdout).',
      );
    }
  }

  /**
   * Dispatches an SMS message.
   */
  async sendSMS(to: string, message: string): Promise<boolean> {
    if (this.isTwilioConfigured && this.twilioClient) {
      try {
        const formattedTo = to.startsWith('+') ? to : `+20${to}`; // Default to Egypt country code
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

  /**
   * Dispatches a WhatsApp message.
   */
  async sendWhatsApp(to: string, message: string): Promise<boolean> {
    if (this.isTwilioConfigured && this.twilioClient && this.twilioWhatsApp) {
      try {
        const formattedTo = to.startsWith('+') ? to : `+20${to}`; // Default to Egypt country code
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

    // Send both for maximum visibility
    await this.sendSMS(to, smsMessage);
    await this.sendWhatsApp(to, whatsappMessage);
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
