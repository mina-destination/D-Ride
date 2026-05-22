import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() data: RegisterDto) {
    const result = await this.authService.register(data);
    return { success: true, data: result, timestamp: new Date().toISOString() };
  }

  @Post('login')
  async login(@Body() data: LoginDto) {
    const user = await this.authService.validateUser(data.email, data.password);
    const result = await this.authService.login(user);
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
}
