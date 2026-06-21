import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    validateUser: jest.fn(),
    login: jest.fn(),
    googleLogin: jest.fn(),
    getProfile: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    changePasswordRequest: jest.fn(),
    changePassword: jest.fn(),
    updateProfile: jest.fn(),
    refreshAccessToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const registerDto: RegisterDto = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '01001234567',
        password: 'password123',
      };
      const mockResult = {
        user: { id: '1', email: 'john@example.com' },
        accessToken: 'token',
      };
      mockAuthService.register.mockResolvedValue(mockResult);

      const response = await controller.register(registerDto);
      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    it('should validate and login user', async () => {
      const loginDto: LoginDto = {
        email: 'john@example.com',
        password: 'password123',
      };
      const mockUser = { id: '1', email: 'john@example.com' };
      const mockLoginResult = { accessToken: 'token', user: mockUser };
      mockAuthService.validateUser.mockResolvedValue(mockUser);
      mockAuthService.login.mockResolvedValue(mockLoginResult);

      const response = await controller.login(loginDto);
      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockLoginResult);
      expect(authService.validateUser).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
      expect(authService.login).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('googleLogin', () => {
    it('should login with Google', async () => {
      const googleDto: GoogleLoginDto = {
        token: 'google-token',
      };
      const mockResult = {
        accessToken: 'token',
        user: { id: '1', email: 'john@example.com' },
      };
      mockAuthService.googleLogin.mockResolvedValue(mockResult);

      const response = await controller.googleLogin(googleDto);
      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(authService.googleLogin).toHaveBeenCalledWith(googleDto);
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const req = { user: { sub: '1' } };
      const mockProfile = {
        id: '1',
        email: 'john@example.com',
        name: 'John Doe',
      };
      mockAuthService.getProfile.mockResolvedValue(mockProfile);

      const response = await controller.getProfile(req);
      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockProfile);
      expect(authService.getProfile).toHaveBeenCalledWith('1');
    });
  });

  describe('forgotPassword', () => {
    it('should request verification code for forgot password', async () => {
      const dto: ForgotPasswordDto = { email: 'john@example.com' };
      const mockResult = { message: 'OTP sent' };
      mockAuthService.forgotPassword.mockResolvedValue(mockResult);

      const response = await controller.forgotPassword(dto);
      expect(response.success).toBe(true);
      expect(response.message).toBe('OTP sent');
      expect(authService.forgotPassword).toHaveBeenCalledWith(
        'john@example.com',
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset password with OTP', async () => {
      const dto: ResetPasswordDto = {
        email: 'john@example.com',
        otp: '123456',
        newPassword: 'newpassword123',
      };
      const mockResult = { message: 'Password reset' };
      mockAuthService.resetPassword.mockResolvedValue(mockResult);

      const response = await controller.resetPassword(dto);
      expect(response.success).toBe(true);
      expect(response.message).toBe('Password reset');
      expect(authService.resetPassword).toHaveBeenCalledWith(dto);
    });
  });

  describe('changePasswordRequest', () => {
    it('should generate change password OTP request', async () => {
      const req = { user: { sub: '1' } };
      const mockResult = { message: 'OTP sent' };
      mockAuthService.changePasswordRequest.mockResolvedValue(mockResult);

      const response = await controller.changePasswordRequest(req);
      expect(response.success).toBe(true);
      expect(response.message).toBe('OTP sent');
      expect(authService.changePasswordRequest).toHaveBeenCalledWith('1');
    });
  });

  describe('changePassword', () => {
    it('should change password', async () => {
      const req = { user: { sub: '1' } };
      const dto: ChangePasswordDto = {
        otp: '123456',
        newPassword: 'newpassword123',
      };
      const mockResult = { message: 'Password changed' };
      mockAuthService.changePassword.mockResolvedValue(mockResult);

      const response = await controller.changePassword(req, dto);
      expect(response.success).toBe(true);
      expect(response.message).toBe('Password changed');
      expect(authService.changePassword).toHaveBeenCalledWith('1', dto);
    });
  });

  describe('updateProfile', () => {
    it('should update profile', async () => {
      const req = { user: { sub: '1' } };
      const dto: UpdateProfileDto = {
        name: 'New Name',
        phone: '01009876543',
      };
      const mockResult = { id: '1', name: 'New Name', phone: '+201009876543' };
      mockAuthService.updateProfile.mockResolvedValue(mockResult);

      const response = await controller.updateProfile(req, dto);
      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(authService.updateProfile).toHaveBeenCalledWith('1', dto);
    });
  });

  describe('refresh', () => {
    it('should refresh access token', async () => {
      const dto: RefreshTokenDto = { refreshToken: 'refresh-token' };
      const mockResult = { accessToken: 'new-access-token' };
      mockAuthService.refreshAccessToken.mockResolvedValue(mockResult);

      const response = await controller.refresh(dto);
      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockResult);
      expect(authService.refreshAccessToken).toHaveBeenCalledWith(
        'refresh-token',
      );
    });
  });

  describe('logout', () => {
    it('should logout user and revoke refresh token', async () => {
      const dto: RefreshTokenDto = { refreshToken: 'refresh-token' };
      mockAuthService.revokeRefreshToken.mockResolvedValue(undefined);

      const response = await controller.logout(dto);
      expect(response.success).toBe(true);
      expect(response.message).toBe('Logged out successfully');
      expect(authService.revokeRefreshToken).toHaveBeenCalledWith(
        'refresh-token',
      );
    });
  });
});
