import { Controller, Get, Put, Body } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('settings')
  getSettings() {
    return this.appService.getSettings();
  }

  @Put('settings')
  saveSettings(@Body() body: any) {
    return this.appService.saveSettings(body);
  }
}
