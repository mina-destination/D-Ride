import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ short: { limit: 3, ttl: 60000 } })
  @Post('register')
  async register(@Body() data: RegisterDto) {
    const result = await this.authService.register(data);
    return { success: true, data: result, timestamp: new Date().toISOString() };
  }

  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(@Body() data: LoginDto) {
    const user = await this.authService.validateUser(data.email, data.password);
    const result = await this.authService.login(user);
    return { success: true, data: result, timestamp: new Date().toISOString() };
  }

  @Post('google')
  async googleLogin(@Body() data: GoogleLoginDto) {
    const result = await this.authService.googleLogin(data);
    return { success: true, data: result, timestamp: new Date().toISOString() };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: any) {
    const profile = await this.authService.getProfile(req.user.sub);
    return {
      success: true,
      data: profile,
      timestamp: new Date().toISOString(),
    };
  }

  @Throttle({ short: { limit: 3, ttl: 60000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() data: ForgotPasswordDto) {
    const result = await this.authService.forgotPassword(data.email);
    return { success: true, ...result, timestamp: new Date().toISOString() };
  }

  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  async resetPassword(@Body() data: ResetPasswordDto) {
    const result = await this.authService.resetPassword(data);
    return { success: true, ...result, timestamp: new Date().toISOString() };
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  @Post('change-password-request')
  async changePasswordRequest(@Request() req: any) {
    const result = await this.authService.changePasswordRequest(req.user.sub);
    return { success: true, ...result, timestamp: new Date().toISOString() };
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @Post('change-password')
  async changePassword(@Request() req: any, @Body() data: ChangePasswordDto) {
    const result = await this.authService.changePassword(req.user.sub, data);
    return { success: true, ...result, timestamp: new Date().toISOString() };
  }
}
