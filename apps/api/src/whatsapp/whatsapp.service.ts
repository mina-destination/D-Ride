import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Client, LocalAuth } from 'whatsapp-web.js';
import { PrismaService } from '../prisma/prisma.service';
import { SupportGateway } from '../support/support.gateway';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger('WhatsappService');
  private client: Client | null = null;
  private status: 'DISCONNECTED' | 'CONNECTING' | 'SCAN_QR' | 'CONNECTED' =
    'DISCONNECTED';
  private qrCode: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => SupportGateway))
    private readonly supportGateway: SupportGateway,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') {
      this.logger.log(
        'Bypassing WhatsApp client initialization in test environment.',
      );
      this.status = 'CONNECTED';
      return;
    }
    this.initializeClient();
  }

  private async initializeClient() {
    this.logger.log(
      'Starting WhatsApp client initialization via whatsapp-web.js...',
    );
    this.status = 'CONNECTING';

    try {
      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: 'dride-session',
          dataPath: path.join(process.cwd(), '.wwebjs_auth'),
        }),
        webVersionCache: {
          type: 'remote',
          remotePath:
            'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        },
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          ],
        },
      });

      // Register Event Listeners
      this.client.on('qr', (qr) => {
        QRCode.toDataURL(qr, (err, url) => {
          if (!err) {
            this.qrCode = url;
            this.status = 'SCAN_QR';
            this.logger.log('WhatsApp QR code generated successfully.');
          } else {
            this.logger.error(
              'Failed to convert WhatsApp QR string to DataURL',
              err,
            );
          }
        });
      });

      this.client.on('authenticated', () => {
        this.logger.log(
          'WhatsApp client authenticated successfully! Loading session...',
        );
      });

      this.client.on('ready', () => {
        this.status = 'CONNECTED';
        this.qrCode = null;
        this.logger.log('WhatsApp client successfully connected!');
      });

      this.client.on('auth_failure', (msg) => {
        this.status = 'DISCONNECTED';
        this.logger.error(`WhatsApp authentication failure: ${msg}`);
      });

      this.client.on('disconnected', (reason) => {
        this.status = 'DISCONNECTED';
        this.qrCode = null;
        this.logger.warn(`WhatsApp client disconnected: ${reason}`);
      });

      this.client.on('message', (message) => {
        this.handleIncomingMessage(message).catch((err) => {
          this.logger.error('Error handling incoming WhatsApp message', err);
        });
      });

      // Trigger initialization
      this.client.initialize().catch((err) => {
        this.logger.error('Failed to run client.initialize()', err);
        this.status = 'DISCONNECTED';
      });
    } catch (error) {
      this.logger.error('Failed to instantiate WhatsApp client', error);
      this.status = 'DISCONNECTED';
    }
  }

  async restart() {
    this.logger.log('Restarting WhatsApp client session...');
    this.status = 'CONNECTING';
    this.qrCode = null;

    if (this.client) {
      try {
        await this.client.destroy();
      } catch (err) {
        this.logger.warn('Failed to cleanly destroy WhatsApp client', err);
      }
      this.client = null;
    }

    // Delete session files to force a new login/QR
    const sessionDir = path.join(process.cwd(), '.wwebjs_auth');
    const cacheDir = path.join(process.cwd(), '.wwebjs_cache');
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
      if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true, force: true });
      }
      this.logger.log('WhatsApp session and version caches cleared.');
    } catch (err) {
      this.logger.error(
        'Failed to clean up WhatsApp session and cache files',
        err,
      );
    }

    // Re-initialize
    this.initializeClient();
  }

  async sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
    if (this.status !== 'CONNECTED' || !this.client) {
      this.logger.warn(
        `WhatsApp client is not connected (Status: ${this.status}). Cannot send message.`,
      );
      return false;
    }

    let cleanPhone = to.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
      cleanPhone = `20${cleanPhone.slice(1)}`; // Prepend Egypt code if starts with 01
    } else if (cleanPhone.startsWith('1') && cleanPhone.length === 10) {
      cleanPhone = `20${cleanPhone}`;
    }

    const formattedRecipient = `${cleanPhone}@c.us`;

    try {
      await this.client.sendMessage(formattedRecipient, message);
      this.logger.log(
        `WhatsApp message successfully sent via whatsapp-web.js to ${formattedRecipient}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp message via whatsapp-web.js to ${formattedRecipient}`,
        error,
      );
      return false;
    }
  }

  getStatus(): { status: string; qrCode: string | null } {
    return {
      status: this.status,
      qrCode: this.qrCode,
    };
  }

  async getBrowserScreenshot(): Promise<string | null> {
    if (!this.client) return null;
    try {
      const page = (this.client as any).pupPage;
      if (page) {
        const screenshotBase64 = await page.screenshot({ encoding: 'base64' });
        return `data:image/png;base64,${screenshotBase64}`;
      }
    } catch (err) {
      this.logger.error('Failed to take browser screenshot', err);
    }
    return null;
  }

  private async handleIncomingMessage(message: any) {
    if (!this.client) {
      return;
    }

    // Only handle chat messages (not groups, media, broadcast channels, or other events)
    const isGroup = message.from.endsWith('@g.us');
    const isMedia = message.hasMedia;

    if (isGroup || isMedia || message.type !== 'chat') {
      return;
    }

    const fromPhone = message.from.replace('@c.us', ''); // format: 201xxxxxxxxx
    const text = (message.body || '').trim();

    this.logger.log(`Incoming WhatsApp message from ${fromPhone}: "${text}"`);

    // Look up user in database
    const cleanPhoneSuffix = fromPhone.startsWith('20')
      ? fromPhone.slice(2)
      : fromPhone;
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: fromPhone },
          { phone: `+${fromPhone}` },
          { phone: cleanPhoneSuffix },
          { phone: `0${cleanPhoneSuffix}` },
        ],
      },
    });

    if (!user) {
      await this.client.sendMessage(
        message.from,
        `Welcome to D-Ride! 🚌\n\n` +
          `This phone number is not registered on our platform.\n` +
          `Please sign up at http://localhost:5173 to start booking trips and tracking shuttles!`,
      );
      return;
    }

    // Check if there is an active WhatsApp live chat support session
    const activeTicket = await this.prisma.supportTicket.findFirst({
      where: {
        userId: user.id,
        status: 'OPEN',
        subject: 'WhatsApp Support Session',
      },
    });

    if (activeTicket) {
      // Check if user is typing EXIT
      if (text.toUpperCase() === 'EXIT') {
        await this.prisma.supportTicket.update({
          where: { id: activeTicket.id },
          data: { status: 'RESOLVED' },
        });

        // Notify operators
        if (this.supportGateway && this.supportGateway.server) {
          this.supportGateway.server
            .to(`ticket_${activeTicket.id}`)
            .emit('ticketClosed', { ticketId: activeTicket.id });
        }

        await this.client.sendMessage(
          message.from,
          `🚪 *Live Chat Ended*\n\n` +
            `Your support session has been resolved. You are back in the main menu.\n\n` +
            `How else can we help you today? Please reply with a number:\n` +
            `1️⃣  *Active Bookings*\n` +
            `2️⃣  *Live Chat with Support*`,
        );
        return;
      }

      // Forward message into the support ticket chat messages
      const chatMsg = await this.prisma.chatMessage.create({
        data: {
          ticketId: activeTicket.id,
          senderId: user.id,
          senderRole: 'PASSENGER',
          senderName: user.name,
          message: text,
        },
      });

      // Emit gateway WebSocket event
      if (this.supportGateway && this.supportGateway.server) {
        this.supportGateway.server
          .to(`ticket_${activeTicket.id}`)
          .emit('newMessage', chatMsg);

        this.supportGateway.server
          .to('support_operators')
          .emit('ticketActivity', {
            ticketId: activeTicket.id,
            lastMessage: text,
            senderName: user.name,
            senderRole: 'PASSENGER',
            createdAt: chatMsg.createdAt,
          });
      }
      return;
    }

    // Menu logic
    if (text === '1') {
      const bookings = await this.prisma.booking.findMany({
        where: {
          userId: user.id,
          status: 'CONFIRMED',
        },
        include: {
          trip: {
            include: {
              route: true,
            },
          },
        },
        orderBy: {
          bookedAt: 'desc',
        },
        take: 3,
      });

      if (bookings.length === 0) {
        await this.client.sendMessage(
          message.from,
          `🎫 *Your Active Bookings*\n\nYou have no active bookings at the moment. Reply with *2* to talk to support.`,
        );
      } else {
        let bookingText = `🎫 *Your Active Bookings (Latest ${bookings.length})*:\n\n`;
        bookings.forEach((b, idx) => {
          const departureDate = new Date(b.trip.departureTime).toLocaleString(
            'en-US',
            {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            },
          );
          const seats = Array.isArray(b.seatNumbers)
            ? (b.seatNumbers as any[]).join(', ')
            : typeof b.seatNumbers === 'string'
              ? b.seatNumbers
              : typeof b.seatNumbers === 'number'
                ? String(b.seatNumbers)
                : b.seatNumbers
                  ? JSON.stringify(b.seatNumbers)
                  : '';
          bookingText +=
            `${idx + 1}. *Route:* ${b.trip.route.name}\n` +
            `   *Departure:* ${departureDate}\n` +
            `   *Seats:* ${seats}\n` +
            `   *Status:* ${b.status}\n\n`;
        });
        bookingText += `Reply with *M* to show the main menu.`;
        await this.client.sendMessage(message.from, bookingText);
      }
      return;
    }

    if (text === '2') {
      const openTicketsCount = await this.prisma.supportTicket.count({
        where: {
          userId: user.id,
          status: 'OPEN',
        },
      });

      if (openTicketsCount >= 5) {
        await this.client.sendMessage(
          message.from,
          `⚠️ *Support Ticket Limit Reached*\n\n` +
            `You already have ${openTicketsCount} open support tickets on D-Ride. Please wait until they are resolved.`,
        );
        return;
      }

      // Spawn WhatsApp support session ticket
      const ticket = await this.prisma.supportTicket.create({
        data: {
          userId: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          subject: 'WhatsApp Support Session',
          message: 'Chat support session started via WhatsApp.',
          status: 'OPEN',
          replies: [],
        },
      });

      // Add chat message
      const chatMsg = await this.prisma.chatMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: user.id,
          senderRole: 'PASSENGER',
          senderName: user.name,
          message: '[Live Chat Connected]',
        },
      });

      // Notify operators
      if (this.supportGateway && this.supportGateway.server) {
        this.supportGateway.server
          .to('support_operators')
          .emit('ticketActivity', {
            ticketId: ticket.id,
            lastMessage: 'Customer connected via WhatsApp',
            senderName: user.name,
            senderRole: 'PASSENGER',
            createdAt: ticket.createdAt,
          });
      }

      await this.client.sendMessage(
        message.from,
        `👨‍💻 *D-Ride Live Support*\n\n` +
          `You are now connected to our support desk! Any message you type here will be sent directly to customer service.\n\n` +
          `_Note: Type *EXIT* to end the support session and return to the main menu._`,
      );
      return;
    }

    // Default Greeting & Main Menu
    const menuMsg =
      `Welcome to D-Ride, *${user.name}*! 🚌 👋\n\n` +
      `How can we help you today? Please reply with one of the numbers below:\n\n` +
      `1️⃣  *Active Bookings* (Query your upcoming rides)\n` +
      `2️⃣  *Live Chat with Support* (Speak to customer service)`;

    await this.client.sendMessage(message.from, menuMsg);
  }
}
