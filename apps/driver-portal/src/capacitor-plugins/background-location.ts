import { registerPlugin, type PluginListenerHandle, type PermissionState } from '@capacitor/core';

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

export interface LocationEnabled {
  enabled: boolean;
}

export interface BatteryOptimizationStatus {
  disabled: boolean;
}

export interface PermissionStatus {
  location: PermissionState;
  backgroundLocation: PermissionState;
  notifications: PermissionState;
}

export interface BackgroundLocationPlugin {
  start(options: BackgroundLocationOptions): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<BackgroundLocationStatus>;
  checkLocationEnabled(): Promise<LocationEnabled>;
  openLocationSettings(): Promise<void>;
  openAppSettings(): Promise<void>;
  isBatteryOptimizationDisabled(): Promise<BatteryOptimizationStatus>;
  requestBatteryOptimization(): Promise<void>;
  openBatterySettings(): Promise<void>;
  checkPermissions(): Promise<PermissionStatus>;
  requestPermissions(permissions?: { permissions: string[] }): Promise<PermissionStatus>;
  addListener(
    eventName: 'locationUpdate',
    listenerFunc: (data: BackgroundLocationData) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

const BackgroundLocation = registerPlugin<BackgroundLocationPlugin>('BackgroundLocation');

export { BackgroundLocation };
