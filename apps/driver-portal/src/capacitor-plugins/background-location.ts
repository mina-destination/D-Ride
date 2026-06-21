import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface BackgroundLocationOptions {
  apiUrl: string;
  token: string;
  vehicleId: string;
  driverId: string;
}

export interface BackgroundLocationStatus {
  running: boolean;
}

export interface BackgroundLocationData {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
}

export interface BackgroundLocationPlugin {
  start(options: BackgroundLocationOptions): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<BackgroundLocationStatus>;
  addListener(
    eventName: 'locationUpdate',
    listenerFunc: (data: BackgroundLocationData) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

const BackgroundLocation = registerPlugin<BackgroundLocationPlugin>('BackgroundLocation');

export { BackgroundLocation };
