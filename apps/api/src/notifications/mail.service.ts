import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private isMailConfigured = false;
  private fromAddress = 'D-Ride <no-reply@dride.com>';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host =
      this.configService.get<string>('SMTP_HOST') || process.env.SMTP_HOST;
    const portStr =
      this.configService.get<string>('SMTP_PORT') || process.env.SMTP_PORT;
    const user =
      this.configService.get<string>('SMTP_USER') || process.env.SMTP_USER;
    const pass =
      this.configService.get<string>('SMTP_PASS') || process.env.SMTP_PASS;
    const from =
      this.configService.get<string>('SMTP_FROM') || process.env.SMTP_FROM;

    if (from) {
      this.fromAddress = from;
    }

    if (host && portStr && user && pass) {
      const port = parseInt(portStr, 10);
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: {
            user,
            pass,
          },
        });
        this.isMailConfigured = true;
        this.logger.log('SMTP mail transporter initialized successfully.');
      } catch (err) {
        this.logger.error('Failed to initialize SMTP transporter', err);
      }
    } else {
      this.logger.warn(
        'SMTP mail server credentials not fully configured. Running mail service in fallback MOCK mode (stdout).',
      );
    }
  }

  async sendMail(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<boolean> {
    if (this.isMailConfigured && this.transporter) {
      try {
        await this.transporter.sendMail({
          from: this.fromAddress,
          to,
          subject,
          text,
          html,
        });
        this.logger.log(`Email successfully dispatched via SMTP to ${to}`);
        return true;
      } catch (error) {
        this.logger.error(`Failed to send SMTP email to ${to}`, error);
        this.logMockMessage('EMAIL [FAILED FALLBACK]', to, subject, text);
        return false;
      }
    } else {
      this.logMockMessage('EMAIL (Mock)', to, subject, text);
      return true;
    }
  }

  async sendOtpEmail(
    to: string,
    name: string,
    otp: string,
    type: 'RESET' | 'CHANGE',
  ): Promise<void> {
    const actionText =
      type === 'RESET' ? 'reset your password' : 'change your password';
    const titleText =
      type === 'RESET'
        ? 'Password Reset Verification'
        : 'Password Change Verification';

    const text =
      `Hi ${name},\n\n` +
      `You requested to ${actionText} for your D-Ride account.\n\n` +
      `Your verification code is: ${otp}\n\n` +
      `This code will expire in 10 minutes.\n\n` +
      `If you did not request this, please ignore this email.`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px; background-color: #0e0e1b; color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #f5b731; margin: 0;">D-Ride Security Portal</h2>
        </div>
        <p>Dear ${name},</p>
        <p>We received a request to <strong>${actionText}</strong> for your account.</p>
        <div style="margin: 24px 0; padding: 16px; background-color: #14142b; border-left: 4px solid #f5b731; border-radius: 4px; text-align: center;">
          <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #f5b731;">${otp}</span>
        </div>
        <p style="font-size: 13px; color: #a3a3a3;">This verification code is active for <strong>10 minutes</strong>. Do not share this OTP with anyone.</p>
        <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 24px 0;" />
        <p style="font-size: 11px; color: #737373; text-align: center;">D-Ride Operations Team &copy; 2026. Authorized Personnel Only.</p>
      </div>
    `;

    await this.sendMail(to, `${titleText} — D-Ride`, text, html);
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    const text =
      `Hi ${name},\n\n` +
      `Welcome to D-Ride! Your passenger account has been successfully created.\n\n` +
      `You can now book rides, manage bookings, and get ticket confirmations directly in your email.\n\n` +
      `Thank you for choosing D-Ride!`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px; background-color: #0e0e1b; color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #f5b731; margin: 0;">Welcome to D-Ride! 🚌</h2>
        </div>
        <p>Dear ${name},</p>
        <p>Welcome to D-Ride! Your passenger account has been successfully created.</p>
        <p>You can now log in, book comfortable minibus rides, manage your tickets, and track drivers in real-time.</p>
        <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 24px 0;" />
        <p style="font-size: 11px; color: #737373; text-align: center;">D-Ride Operations Team &copy; 2026. Have a wonderful journey!</p>
      </div>
    `;

    await this.sendMail(to, `Welcome to D-Ride! 🚌`, text, html);
  }

  private logMockMessage(
    channel: string,
    to: string,
    subject: string,
    message: string,
  ) {
    const border = '═'.repeat(60);
    const time = new Date().toLocaleTimeString();

    console.log(`
╔${border}╗
║ 📡  NOTIFICATION CHANNEL: ${channel.padEnd(33)} ║
║ 🕒  TIME: ${time.padEnd(49)} ║
║ 📧  RECIPIENT: ${to.padEnd(44)} ║
║ 📝  SUBJECT: ${subject.padEnd(46)} ║
╠${border}╣
${message
  .split('\n')
  .map((line) => `║ ${line.padEnd(58)} ║`)
  .join('\n')}
╚${border}╝
`);
  }
}
