import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../notifications/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let mockPrismaService: any;
  let mockJwtService: any;
  let mockMailService: any;
  let mockNotificationsService: any;

  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    phone: '+201001234567',
    password: 'hashed_password',
    role: 'PASSENGER',
    walletBalance: 0,
    resetPasswordOtp: null,
    resetPasswordOtpExpires: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      rolePermission: {
        findUnique: jest.fn(),
      },
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('test-jwt-token'),
    };

    mockMailService = {
      sendWelcomeEmail: jest.fn().mockResolvedValue(true),
      sendOtpEmail: jest.fn().mockResolvedValue(true),
    };

    mockNotificationsService = {
      sendWhatsApp: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: MailService, useValue: mockMailService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw ConflictException if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.register({ name: 'Test', email: 'test@example.com', phone: '01001234567', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create a new user and return access token', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.rolePermission.findUnique.mockResolvedValue({ role: 'PASSENGER', permissions: [] });
      mockPrismaService.user.create.mockResolvedValue(mockUser);

      const result = await service.register({ name: 'Test User', email: 'test@example.com', phone: '01001234567', password: 'password123' });

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBe('test-jwt-token');
      expect(mockMailService.sendWelcomeEmail).toHaveBeenCalled();
    });

    it('should normalize Egyptian phone numbers', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.rolePermission.findUnique.mockResolvedValue({ role: 'PASSENGER', permissions: [] });
      mockPrismaService.user.create.mockImplementation(({ data }: any) => Promise.resolve({ ...mockUser, phone: data.phone }));

      const result = await service.register({ name: 'Test', email: 'test2@example.com', phone: '01001234567', password: 'password123' });

      expect(result.user.phone).toBe('+201001234567');
    });
  });

  describe('validateUser', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.validateUser('nonexistent@test.com', 'password')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.validateUser('test@example.com', 'wrongpassword')).rejects.toThrow(UnauthorizedException);
    });

    it('should return user data if credentials are valid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('Test User');
      expect(result.password).toBeUndefined();
    });
  });

  describe('login', () => {
    it('should return user with access token and permissions', async () => {
      mockPrismaService.rolePermission.findUnique.mockResolvedValue({ role: 'PASSENGER', permissions: [] });

      const result = await service.login({ id: 'user-1', email: 'test@example.com', name: 'Test User', role: 'PASSENGER' });

      expect(result.accessToken).toBe('test-jwt-token');
      expect(result.user.email).toBe('test@example.com');
    });
  });

  describe('getProfile', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent-id')).rejects.toThrow(UnauthorizedException);
    });

    it('should return user profile without password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.rolePermission.findUnique.mockResolvedValue({ role: 'PASSENGER', permissions: [] });

      const result = await service.getProfile('user-1');

      expect(result.email).toBe('test@example.com');
      expect(result.password).toBeUndefined();
    });
  });

  describe('forgotPassword', () => {
    it('should return generic message even if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('nonexistent@test.com');

      expect(result.message).toContain('If the email exists');
    });

    it('should generate OTP and send email if user exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.forgotPassword('test@example.com');

      expect(result.message).toContain('If the email exists');
      expect(mockPrismaService.user.update).toHaveBeenCalled();
      expect(mockMailService.sendOtpEmail).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const userWithOtp = {
      ...mockUser,
      resetPasswordOtp: 'hashed-otp',
      resetPasswordOtpExpires: new Date(Date.now() + 10 * 60 * 1000),
    };

    it('should throw BadRequestException if user has no OTP', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.resetPassword({ email: 'test@example.com', otp: '123456', newPassword: 'newpassword123' })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if OTP is invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(userWithOtp);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.resetPassword({ email: 'test@example.com', otp: '000000', newPassword: 'newpassword123' })).rejects.toThrow(BadRequestException);
    });

    it('should reset password successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(userWithOtp);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      mockPrismaService.user.update.mockResolvedValue({ ...userWithOtp, password: 'new-hashed-password', resetPasswordOtp: null, resetPasswordOtpExpires: null });

      const result = await service.resetPassword({ email: 'test@example.com', otp: '123456', newPassword: 'newpassword123' });

      expect(result.message).toContain('reset successfully');
    });
  });

  describe('changePasswordRequest', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.changePasswordRequest('nonexistent-id')).rejects.toThrow(UnauthorizedException);
    });

    it('should send OTP email for password change', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.changePasswordRequest('user-1');

      expect(result.message).toContain('OTP has been sent');
      expect(mockMailService.sendOtpEmail).toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    const userWithOtp = {
      ...mockUser,
      resetPasswordOtp: 'hashed-otp',
      resetPasswordOtpExpires: new Date(Date.now() + 10 * 60 * 1000),
    };

    it('should throw BadRequestException if no active request', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.changePassword('user-1', { otp: '123456', newPassword: 'newpassword123' })).rejects.toThrow(BadRequestException);
    });

    it('should change password successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(userWithOtp);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      mockPrismaService.user.update.mockResolvedValue({ ...userWithOtp, password: 'new-hashed-password', resetPasswordOtp: null, resetPasswordOtpExpires: null });

      const result = await service.changePassword('user-1', { otp: '123456', newPassword: 'newpassword123' });

      expect(result.message).toContain('changed successfully');
    });
  });

  describe('updateProfile', () => {
    it('should update user name and phone', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({ ...mockUser, name: 'Updated Name', phone: '+201009876543' });
      mockPrismaService.rolePermission.findUnique.mockResolvedValue({ role: 'PASSENGER', permissions: [] });

      const result = await service.updateProfile('user-1', { name: 'Updated Name', phone: '01009876543' });

      expect(result.name).toBe('Updated Name');
      expect(result.phone).toBe('+201009876543');
    });
  });
});
