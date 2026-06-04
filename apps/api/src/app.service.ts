import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AppService {
  private readonly settingsPath = path.join(__dirname, '..', 'settings.json');

  getHello(): string {
    return 'D-Ride Central API Gateway';
  }

  getSettings(): any {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to read settings file:', error);
    }
    // Default fallback values
    return {
      appName: 'D-Ride',
      supportEmail: 'support@dride.com',
      supportPhone: '+20 100 123 4567',
      currency: 'EGP',
      paymobIntegrationId: '123456',
      paymobFrameId: '78901',
      isSandbox: true,
      maxSeats: 4,
      bookingWindow: 14,
      cancelTimeout: 15,
      enableLiveTracking: true,
      gpsInterval: 5,
    };
  }

  saveSettings(settings: any): any {
    try {
      // Remove any unwanted properties or keep all of them
      fs.writeFileSync(
        this.settingsPath,
        JSON.stringify(settings, null, 2),
        'utf8',
      );
      return settings;
    } catch (error) {
      console.error('Failed to write settings file:', error);
      throw new Error('Failed to save system settings');
    }
  }
}
