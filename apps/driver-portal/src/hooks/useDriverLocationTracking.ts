import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Device } from '@capacitor/device';
import { BackgroundLocation } from '../capacitor-plugins/background-location';
import { socketService } from '../services/socket';
import { API_URL } from '../services/api';

export interface TrackingContext {
  vehicleId: string;
  driverId: string;
  tripStatus: string;
}

export function useDriverLocationTracking(
  getTrackingContext: () => TrackingContext | null,
  options?: {
    onLocationUpdate?: (lat: number, lng: number, speed?: number, heading?: number) => void;
  }
) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [speed, setSpeed] = useState(0);
  const [heading, setHeading] = useState(0);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<{
    isRunning: boolean;
    lastSentTime: number;
    authFailed: boolean;
    lastResponseCode: number;
    consecutiveNetworkFailures: number;
    lastResponseBody: string;
  } | null>(null);

  const geoWatchId = useRef<string | null>(null);
  const bgLocationListenerRef = useRef<any>(null);
  const getContextRef = useRef(getTrackingContext);

  useEffect(() => {
    getContextRef.current = getTrackingContext;
  }, [getTrackingContext]);

  // Request all permissions natively
  const requestTrackingPermissions = useCallback(async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return true;

    // 1. Foreground Location (Critical)
    try {
      const geoPerm = await Geolocation.checkPermissions();
      if (geoPerm.location !== 'granted') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted') {
          return false;
        }
      }
    } catch (e) {
      console.error('[LocationTracking] Failed to request foreground location:', e);
      return false;
    }

    // 2. Notifications (Gated on Android 13+)
    try {
      const checkNotif = await BackgroundLocation.checkPermissions();
      if (checkNotif.notifications !== 'granted') {
        await BackgroundLocation.requestPermissions({ permissions: ['notifications'] });
      }
    } catch (e) {
      console.warn('[LocationTracking] Non-critical: Failed to request notifications natively:', e);
    }

    // 3. Background Location (Gated for reliable background service)
    try {
      const checkBg = await BackgroundLocation.checkPermissions();
      if (checkBg.backgroundLocation !== 'granted') {
        await BackgroundLocation.requestPermissions({ permissions: ['backgroundLocation'] });
      }
    } catch (e) {
      console.warn('[LocationTracking] Non-critical: Failed to request background location natively:', e);
    }

    return true;
  }, []);

  const handleSuccess = useCallback(
    async (lat: number, lng: number, speedVal?: number | null, headingVal?: number | null) => {
      setCurrentCoords({ lat, lng });
      const computedSpeed = speedVal != null && speedVal > 0 ? speedVal * 3.6 : 0;
      setSpeed(Number(computedSpeed.toFixed(1)));
      if (headingVal != null) {
        setHeading(headingVal);
      }

      if (options?.onLocationUpdate) {
        options.onLocationUpdate(lat, lng, computedSpeed, headingVal ?? undefined);
      }

      const context = getContextRef.current();
      if (!context) return;

      const vehicleId = context.vehicleId;
      const driverId = context.driverId;

      if (!vehicleId || !driverId) return;

      let batteryLevel: number | null = null;
      try {
        if (Capacitor.isNativePlatform()) {
          const info = await Device.getBatteryInfo();
          batteryLevel = Math.round((info.batteryLevel || 1) * 100);
        } else if ('getBattery' in navigator) {
          const battery = await (navigator as any).getBattery();
          batteryLevel = Math.round(battery.level * 100);
        }
      } catch (e) {
        console.warn('[LocationTracking] Failed to get battery info:', e);
      }

      socketService.sendLocation({
        vehicleId,
        driverId,
        longitude: lng,
        latitude: lat,
        speed: computedSpeed,
        heading: headingVal ?? null,
        battery: batteryLevel,
      });
    },
    [options]
  );

  const handleFailure = useCallback((errorMsg: string) => {
    console.warn('[LocationTracking] GPS error:', errorMsg);
    setGpsError(errorMsg);
    setIsStreaming(false);
    setSpeed(0);
  }, []);

  // Start background and foreground location tracking
  const startLocationStream = useCallback(async () => {
    if (isStreaming) return;

    const context = getContextRef.current();
    if (!context || !context.vehicleId || !context.driverId) {
      console.warn('[LocationTracking] startLocationStream deferred: context incomplete', context);
      return;
    }

    setGpsError(null);
    setIsStreaming(true);

    const watchOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    };

    if (Capacitor.isNativePlatform()) {
      const token = localStorage.getItem('dride_driver_token') || '';
      try {
        const startResult = await BackgroundLocation.start({
          apiUrl: API_URL,
          token,
          vehicleId: context.vehicleId,
          driverId: context.driverId,
        });
        console.log('[LocationTracking] BackgroundLocation started:', startResult);
      } catch (err) {
        console.warn('[LocationTracking] Failed to start native background service:', err);
      }

      try {
        const watchId = await Geolocation.watchPosition(watchOptions, (position, err) => {
          if (err) {
            handleFailure(err.message || 'Native Geolocation error');
            return;
          }
          if (position?.coords) {
            handleSuccess(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.speed,
              position.coords.heading
            );
          } else {
            handleFailure('No coordinates from native GPS');
          }
        });
        geoWatchId.current = watchId;
      } catch (err: any) {
        handleFailure(err.message || 'Failed to watch native position');
      }

      try {
        if (bgLocationListenerRef.current) {
          bgLocationListenerRef.current.remove();
          bgLocationListenerRef.current = null;
        }
        bgLocationListenerRef.current = await BackgroundLocation.addListener(
          'locationUpdate',
          (data) => {
            handleSuccess(data.latitude, data.longitude, data.speed / 3.6, data.heading);
          }
        );
      } catch (err) {
        console.warn('[LocationTracking] Failed to add background location listener:', err);
      }
    } else {
      if ('geolocation' in navigator) {
        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            handleSuccess(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.speed,
              position.coords.heading
            );
          },
          (error) => {
            handleFailure(error.message);
          },
          watchOptions
        );
        geoWatchId.current = watchId as any;
      } else {
        handleFailure('Geolocation is not supported by this browser');
      }
    }
  }, [isStreaming, handleSuccess, handleFailure]);

  const cleanupWebviewListeners = useCallback(() => {
    if (bgLocationListenerRef.current) {
      bgLocationListenerRef.current.remove();
      bgLocationListenerRef.current = null;
    }

    if (geoWatchId.current !== null) {
      const oldId = geoWatchId.current;
      geoWatchId.current = null;
      if (Capacitor.isNativePlatform()) {
        Geolocation.clearWatch({ id: oldId }).catch((err) =>
          console.warn('[LocationTracking] clearWatch failed:', err)
        );
      } else {
        navigator.geolocation.clearWatch(oldId as any);
      }
    }
    setIsStreaming(false);
    setSpeed(0);
    setHeading(0);
  }, []);

  const stopLocationStream = useCallback(() => {
    cleanupWebviewListeners();
    if (Capacitor.isNativePlatform()) {
      BackgroundLocation.stop().catch((err) =>
        console.warn('[LocationTracking] Failed to stop background location:', err)
      );
    }
  }, [cleanupWebviewListeners]);

  // Fetch metrics diagnostics
  const fetchDiagnostics = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const diag = await BackgroundLocation.getDiagnostics();
      setDiagnostics(diag);
    } catch (err) {
      console.warn('[LocationTracking] Failed to get diagnostics:', err);
    }
  }, []);

  // Poll diagnostics periodically while streaming
  useEffect(() => {
    if (!isStreaming) {
      setDiagnostics(null);
      return;
    }
    fetchDiagnostics();
    const interval = setInterval(fetchDiagnostics, 10000); // every 10s
    return () => clearInterval(interval);
  }, [isStreaming, fetchDiagnostics]);

  // visibilitychange listener for app resume recovery
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;

      try {
        const status = await BackgroundLocation.isRunning();
        console.log('[LocationTracking] Visibility change: visible. Native running:', status.running);
        
        // If the service is running, also refresh diagnostics
        if (status.running) {
          fetchDiagnostics();
        } else {
          // If the service is dead but we think we should be streaming, restart it!
          const context = getContextRef.current();
          if (isStreaming && context && context.tripStatus === 'IN_TRANSIT') {
            console.log('[LocationTracking] Service died but should be streaming. Restarting...');
            await BackgroundLocation.restart();
          }
        }
      } catch (err) {
        console.warn('[LocationTracking] Resume recovery check failed:', err);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isStreaming, fetchDiagnostics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupWebviewListeners();
    };
  }, [cleanupWebviewListeners]);

  return {
    isStreaming,
    currentCoords,
    speed,
    heading,
    gpsError,
    diagnostics,
    startLocationStream,
    stopLocationStream,
    requestTrackingPermissions,
  };
}
