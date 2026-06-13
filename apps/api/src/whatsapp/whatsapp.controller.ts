import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Roles('ADMIN', 'SUPER_ADMIN', 'OWNER', 'OPERATION')
  @Get('status')
  getStatus() {
    return this.whatsappService.getStatus();
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'OWNER', 'OPERATION')
  @Post('restart')
  async restart() {
    await this.whatsappService.restart();
    return {
      success: true,
      message: 'WhatsApp client session cleared and restarted.',
    };
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'OWNER', 'OPERATION')
  @Get('screenshot')
  async getScreenshot() {
    const screenshot = await this.whatsappService.getBrowserScreenshot();
    return { screenshot };
  }
}
