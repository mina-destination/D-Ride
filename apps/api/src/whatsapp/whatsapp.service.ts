import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { create, ev, Client, ChatId } from '@open-wa/wa-automate';
import { PrismaService } from '../prisma/prisma.service';
import { SupportGateway } from '../support/support.gateway';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger('WhatsappService');
  private client: Client | null = null;
  private status: 'DISCONNECTED' | 'CONNECTING' | 'SCAN_QR' | 'CONNECTED' = 'DISCONNECTED';
  private qrCode: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => SupportGateway))
    private readonly supportGateway: SupportGateway,
  ) {}

  onModuleInit() {
    this.initializeClient();
  }

  private async initializeClient() {
    this.logger.log('Starting WhatsApp client initialization...');
    this.status = 'CONNECTING';

    // 1. Register listener for QR codes (must be registered BEFORE create())
    ev.on('qr.**', async (qrcode, sessionId) => {
      if (sessionId === 'dride-session') {
        this.qrCode = qrcode;
        this.status = 'SCAN_QR';
        this.logger.log(`WhatsApp QR code generated for session: ${sessionId}`);
      }
    });

    try {
      // 2. Start the client
      this.client = await create({
        sessionId: 'dride-session',
        multiDevice: true,
        authTimeout: 0,
        qrTimeout: 0,
        headless: true,
        disableSpins: true,
        qrLogSkip: true,
        useChrome: true,
        customUserAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      });

      this.status = 'CONNECTED';
      this.qrCode = null;
      this.logger.log('WhatsApp client successfully connected!');

      // 3. Register incoming message listener
      this.client.onMessage(async (message) => {
        try {
          await this.handleIncomingMessage(message);
        } catch (err) {
          this.logger.error('Error handling incoming WhatsApp message', err);
        }
      });
    } catch (error) {
      this.logger.error('Failed to connect WhatsApp client', error);
      this.status = 'DISCONNECTED';
    }
  }

  async restart() {
    this.logger.log('Restarting WhatsApp client session...');
    this.status = 'CONNECTING';
    this.qrCode = null;

    if (this.client) {
      try {
        await this.client.kill();
      } catch (err) {
        this.logger.warn('Failed to cleanly kill WhatsApp client', err);
      }
      this.client = null;
    }

    // Delete session files to force a new login/QR
    const sessionDir = path.join(process.cwd(), '_IGNORE_dride-session');
    const sessionFile = path.join(process.cwd(), 'dride-session.data.json');
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
      if (fs.existsSync(sessionFile)) {
        fs.unlinkSync(sessionFile);
      }
      this.logger.log('WhatsApp session cache cleared.');
    } catch (err) {
      this.logger.error('Failed to clean up WhatsApp session files', err);
    }

    // Re-initialize
    this.initializeClient();
  }

  async sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
    if (this.status !== 'CONNECTED' || !this.client) {
      this.logger.warn(`WhatsApp client is not connected (Status: ${this.status}). Cannot send message.`);
      return false;
    }

    // OpenWA requires recipient formatted as 201xxxxxxx@c.us
    let cleanPhone = to.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
      cleanPhone = `20${cleanPhone.slice(1)}`; // Prepend Egypt code if starts with 01
    } else if (cleanPhone.startsWith('1') && cleanPhone.length === 10) {
      cleanPhone = `20${cleanPhone}`;
    }

    const formattedRecipient = `${cleanPhone}@c.us`;

    try {
      await this.client.sendText(formattedRecipient as ChatId, message);
      this.logger.log(`WhatsApp message successfully sent via OpenWA to ${formattedRecipient}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp message via OpenWA to ${formattedRecipient}`, error);
      return false;
    }
  }

  getStatus(): { status: string; qrCode: string | null } {
    return {
      status: this.status,
      qrCode: this.qrCode,
    };
  }

  private async handleIncomingMessage(message: any) {
    if (!this.client) {
      return;
    }
    // Only handle chat messages (not groups, media, broadcast channels, or other events)
    if (message.isGroupMsg || message.isMedia || message.type !== 'chat') {
      return;
    }

    const fromPhone = message.from.replace('@c.us', ''); // format: 201xxxxxxxxx
    const text = (message.body || '').trim();

    this.logger.log(`Incoming WhatsApp message from ${fromPhone}: "${text}"`);

    // Look up user in database
    // Match phone patterns (e.g. "+201...", "201...", "01...")
    const cleanPhoneSuffix = fromPhone.startsWith('20') ? fromPhone.slice(2) : fromPhone;
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
      await this.client.sendText(
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
          this.supportGateway.server.to(`ticket_${activeTicket.id}`).emit('ticketClosed', { ticketId: activeTicket.id });
        }

        await this.client.sendText(
          message.from,
          `🚪 *Live Chat Ended*\n\n` +
          `Your support session has been resolved. You are back in the main menu.\n\n` +
          `How else can we help you today? Please reply with a number:\n` +
          `1️⃣  *Active Bookings*\n` +
          `2️⃣  *Wallet Balance*\n` +
          `3️⃣  *Live Chat with Support*`
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
        this.supportGateway.server.to(`ticket_${activeTicket.id}`).emit('newMessage', chatMsg);
        
        this.supportGateway.server.to('support_operators').emit('ticketActivity', {
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
        await this.client.sendText(
          message.from,
          `🎫 *Your Active Bookings*\n\nYou have no active bookings at the moment. Reply with *3* to talk to support.`,
        );
      } else {
        let bookingText = `🎫 *Your Active Bookings (Latest ${bookings.length})*:\n\n`;
        bookings.forEach((b, idx) => {
          const departureDate = new Date(b.trip.departureTime).toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          const seats = Array.isArray(b.seatNumbers) ? (b.seatNumbers as any[]).join(', ') : b.seatNumbers;
          bookingText += 
            `${idx + 1}. *Route:* ${b.trip.route.name}\n` +
            `   *Departure:* ${departureDate}\n` +
            `   *Seats:* ${seats}\n` +
            `   *Status:* ${b.status}\n\n`;
        });
        bookingText += `Reply with *M* to show the main menu.`;
        await this.client.sendText(message.from, bookingText);
      }
      return;
    }

    if (text === '2') {
      await this.client.sendText(
        message.from,
        `💵 *Your Wallet Balance*\n\n` +
        `Current Balance: *EGP ${user.walletBalance.toFixed(2)}*\n\n` +
        `Reply with *M* to show the main menu.`,
      );
      return;
    }

    if (text === '3') {
      const openTicketsCount = await this.prisma.supportTicket.count({
        where: {
          userId: user.id,
          status: 'OPEN',
        },
      });

      if (openTicketsCount >= 5) {
        await this.client.sendText(
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
        this.supportGateway.server.to('support_operators').emit('ticketActivity', {
          ticketId: ticket.id,
          lastMessage: 'Customer connected via WhatsApp',
          senderName: user.name,
          senderRole: 'PASSENGER',
          createdAt: ticket.createdAt,
        });
      }

      await this.client.sendText(
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
      `2️⃣  *Wallet Balance* (Check your account funds)\n` +
      `3️⃣  *Live Chat with Support* (Speak to customer service)`;

    await this.client.sendText(message.from, menuMsg);
  }
}
