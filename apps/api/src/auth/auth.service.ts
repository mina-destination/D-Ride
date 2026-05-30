import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        phone,
        password: hashedPassword,
        role: Role.PASSENGER,
      },
    });

    this.logger.log(`User registered: ${user.email} (${user.role})`);

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
          throw new UnauthorizedException('Invalid Google token: no email in payload');
        }
        verifiedEmail = payload.email;
        verifiedName = payload.name || data.name;
        this.logger.log(`Google token verified for: ${verifiedEmail}`);
      } catch (err: any) {
        this.logger.error(`Google token verification failed: ${err.message}`);
        throw new UnauthorizedException('Google authentication failed: invalid token');
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
}
