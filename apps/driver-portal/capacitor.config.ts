import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dride.driver',
  appName: 'D-Ride Driver Portal',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
