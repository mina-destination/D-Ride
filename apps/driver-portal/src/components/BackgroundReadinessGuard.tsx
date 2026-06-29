import React, { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { BackgroundLocation } from '../capacitor-plugins/background-location';
import LocationPermissionStepper from './LocationPermissionStepper';

interface BackgroundReadinessGuardProps {
  children: React.ReactNode;
}

export default function BackgroundReadinessGuard({ children }: BackgroundReadinessGuardProps) {
  const [checking, setChecking] = useState(true);
  const [passed, setPassed] = useState(false);

  const checkReadiness = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      setPassed(true);
      setChecking(false);
      return;
    }

    try {
      // 1. Check GPS sensor state
      const gps = await BackgroundLocation.checkLocationEnabled();

      // 2. Check main permissions
      const perms = await BackgroundLocation.checkPermissions();

      // 3. Check battery optimization exemption
      const battery = await BackgroundLocation.isBatteryOptimizationDisabled();

      const isReady =
        gps.enabled &&
        perms.location === 'granted' &&
        perms.backgroundLocation === 'granted' &&
        battery.disabled;

      setPassed(isReady);
    } catch (err) {
      console.error('[ReadinessGuard] Failed to check background readiness:', err);
      setPassed(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkReadiness();
  }, [checkReadiness]);

  // App resume detection to recheck immediately if driver changed settings
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setChecking(true);
        checkReadiness();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkReadiness]);

  if (checking) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#0d0d0d',
          color: '#fff',
          fontFamily: 'Inter, sans-serif',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: 'var(--primary, #f5b731)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <span style={{ fontSize: '14px', color: '#a3a3a3', letterSpacing: '0.5px' }}>
          Verifying tracking readiness...
        </span>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!passed) {
    return (
      <div
        style={{
          height: '100vh',
          background: '#0d0d0d',
        }}
      >
        <LocationPermissionStepper
          isOpen={true}
          onClose={() => {}}
          onComplete={() => {
            setChecking(true);
            checkReadiness();
          }}
          blocking={true}
        />
      </div>
    );
  }

  return <>{children}</>;
}
