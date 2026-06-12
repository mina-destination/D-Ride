import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { MailService } from '../notifications/mail.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getPermissionsForRole(role: string): Promise<string[]> {
    const roleEnum = role.toUpperCase() as Role;
    if (roleEnum === Role.OWNER) {
      return [
        'dashboard',
        'routes',
        'trips',
        'vehicles',
        'drivers',
        'bookings',
        'payments',
        'passengers',
        'crm',
        'settings',
      ];
    }
    const rolePerm = await this.prisma.rolePermission.findUnique({
      where: { role: roleEnum },
    });
    return rolePerm ? (rolePerm.permissions as string[]) : [];
  }

  async register(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }) {
    const { name, email, phone, password } = data;
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    let normalizedPhone = phone;
    if (phone) {
      const clean = phone.replace(/\D/g, '');
      if (clean.startsWith('0') && clean.length === 11) {
        normalizedPhone = '+20' + clean.slice(1);
      } else if (clean.startsWith('20') && clean.length === 12) {
        normalizedPhone = '+' + clean;
      } else if (!phone.startsWith('+')) {
        normalizedPhone = '+' + clean;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        phone: normalizedPhone,
        password: hashedPassword,
        role: Role.PASSENGER,
      },
    });

    this.logger.log(`User registered: ${user.email} (${user.role})`);

    // Asynchronously send a welcome email
    this.mailService.sendWelcomeEmail(user.email, user.name).catch((err) => {
      this.logger.error(`Failed to send welcome email to ${user.email}:`, err);
    });

    // Asynchronously send a welcome WhatsApp message if phone is provided
    if (user.phone) {
      const welcomeMsg = 
        `Welcome to *D-Ride*, ${user.name}! 🚌 👋\n\n` +
        `Your account has been registered successfully with your phone number.\n\n` +
        `You can now use this chat to query your active bookings, check wallet balance, or chat with our live support anytime! Just send any message here to open the main menu.`;
      
      this.notificationsService.sendWhatsApp(user.phone, welcomeMsg).catch((err) => {
        this.logger.error(`Failed to send welcome WhatsApp message to ${user.phone}:`, err);
      });
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const permissions = await this.getPermissionsForRole(user.role);
    return {
      user: {
        _id: user.id,
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        permissions,
      },
      accessToken: this.jwtService.sign(payload),
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      _id: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };
  }

  async login(user: any) {
    const payload = {
      sub: user.id || user._id,
      email: user.email,
      role: user.role,
    };
    this.logger.log(`User logged in: ${user.email}`);
    const permissions = await this.getPermissionsForRole(user.role);
    return {
      user: {
        _id: user.id || user._id,
        id: user.id || user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        permissions,
      },
      accessToken: this.jwtService.sign(payload),
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const permissions = await this.getPermissionsForRole(user.role);
    const result = { ...user, _id: user.id };
    delete (result as any).password;
    return {
      ...result,
      permissions,
    };
  }

  async googleLogin(data: { email: string; name: string; googleId: string }) {
    // Verify the Google ID token server-side to prevent impersonation
    const { OAuth2Client } = await import('google-auth-library');
    const googleClientId = process.env.GOOGLE_CLIENT_ID;

    let verifiedEmail = data.email;
    let verifiedName = data.name;

    if (googleClientId) {
      try {
        const client = new OAuth2Client(googleClientId);
        const ticket = await client.verifyIdToken({
          idToken: data.googleId,
          audience: googleClientId,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          throw new UnauthorizedException(
            'Invalid Google token: no email in payload',
          );
        }
        verifiedEmail = payload.email;
        verifiedName = payload.name || data.name;
        this.logger.log(`Google token verified for: ${verifiedEmail}`);
      } catch (err: any) {
        this.logger.error(`Google token verification failed: ${err.message}`);
        throw new UnauthorizedException(
          'Google authentication failed: invalid token',
        );
      }
    } else {
      this.logger.warn(
        'GOOGLE_CLIENT_ID not configured. Skipping token verification (development mode only).',
      );
    }

    let user = await this.prisma.user.findUnique({
      where: { email: verifiedEmail },
    });

    if (!user) {
      // Create user since they don't exist
      const randomPassword =
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
      const hashedPassword = await bcrypt.hash(randomPassword, 12);
      user = await this.prisma.user.create({
        data: {
          name: verifiedName,
          email: verifiedEmail,
          phone: '',
          password: hashedPassword,
          role: Role.PASSENGER,
        },
      });
      this.logger.log(`Google User registered: ${user.email} (${user.role})`);

      // Asynchronously send a welcome email
      const userEmail = user.email;
      const userName = user.name;
      this.mailService.sendWelcomeEmail(userEmail, userName).catch((err) => {
        this.logger.error(`Failed to send welcome email to ${userEmail}:`, err);
      });
    } else {
      this.logger.log(`Google User logged in: ${user.email}`);
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const permissions = await this.getPermissionsForRole(user.role);
    return {
      user: {
        _id: user.id,
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        permissions,
      },
      accessToken: this.jwtService.sign(payload),
    };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Generic message to avoid email enumeration
      return { message: 'If the email exists, an OTP has been sent.' };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const hashedOtp = await bcrypt.hash(otp, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordOtp: hashedOtp,
        resetPasswordOtpExpires: expires,
      },
    });

    await this.mailService.sendOtpEmail(user.email, user.name, otp, 'RESET');

    return { message: 'If the email exists, an OTP has been sent.' };
  }

  async resetPassword(data: {
    email: string;
    otp: string;
    newPassword: string;
  }): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (!user || !user.resetPasswordOtp || !user.resetPasswordOtpExpires) {
      throw new BadRequestException('Invalid OTP or email');
    }

    const isValidOtp = await bcrypt.compare(data.otp, user.resetPasswordOtp);
    if (!isValidOtp) {
      throw new BadRequestException('Invalid OTP');
    }

    if (new Date() > user.resetPasswordOtpExpires) {
      throw new BadRequestException('OTP has expired');
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordOtp: null,
        resetPasswordOtpExpires: null,
      },
    });

    return { message: 'Password has been reset successfully.' };
  }

  async changePasswordRequest(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const hashedOtp = await bcrypt.hash(otp, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        resetPasswordOtp: hashedOtp,
        resetPasswordOtpExpires: expires,
      },
    });

    await this.mailService.sendOtpEmail(user.email, user.name, otp, 'CHANGE');

    return { message: 'OTP has been sent to your email.' };
  }

  async changePassword(
    userId: string,
    data: { otp: string; newPassword: string },
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.resetPasswordOtp || !user.resetPasswordOtpExpires) {
      throw new BadRequestException('No password change request active');
    }

    const isValidOtp = await bcrypt.compare(data.otp, user.resetPasswordOtp);
    if (!isValidOtp) {
      throw new BadRequestException('Invalid OTP');
    }

    if (new Date() > user.resetPasswordOtpExpires) {
      throw new BadRequestException('OTP has expired');
    }

    const hashedPassword = await bcrypt.hash(data.newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        resetPasswordOtp: null,
        resetPasswordOtpExpires: null,
      },
    });

    return { message: 'Password changed successfully.' };
  }

  async updateProfile(userId: string, data: { name?: string; phone?: string }) {
    const { name, phone } = data;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) {
      let normalizedPhone = phone;
      if (phone) {
        const clean = phone.replace(/\D/g, '');
        if (clean.startsWith('0') && clean.length === 11) {
          normalizedPhone = '+20' + clean.slice(1);
        } else if (clean.startsWith('20') && clean.length === 12) {
          normalizedPhone = '+' + clean;
        } else if (!phone.startsWith('+')) {
          normalizedPhone = '+' + clean;
        }
      }
      updateData.phone = normalizedPhone;
    }

    const oldUser = await this.prisma.user.findUnique({ where: { id: userId } });
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Send WhatsApp notification if the phone number was updated/linked
    if (user.phone && user.phone !== oldUser?.phone) {
      const welcomeMsg = 
        `Welcome to *D-Ride*, ${user.name}! 🚌 👋\n\n` +
        `Your phone number has been updated/linked successfully to your account.\n\n` +
        `Use this chat to query your active bookings, check wallet balance, or speak with customer service!`;
      this.notificationsService.sendWhatsApp(user.phone, welcomeMsg).catch((err) => {
        this.logger.error(`Failed to send link WhatsApp message to ${user.phone}:`, err);
      });
    }

    const permissions = await this.getPermissionsForRole(user.role);
    const result = { ...user, _id: user.id };
    delete (result as any).password;
    return {
      ...result,
      permissions,
    };
  }
}
