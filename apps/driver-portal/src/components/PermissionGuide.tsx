import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { BackgroundLocation } from '../capacitor-plugins/background-location';
import {
  Globe,
  Navigation,
  Bell,
  Battery,
  MapPin,
  X,
  Check,
} from 'lucide-react';

interface PermissionGuideProps {
  visible: boolean;
  onComplete: () => void;
  onClose: () => void;
}

type PermissionStep = 'location' | 'background_location' | 'gps' | 'notifications' | 'battery';

interface StepState {
  id: PermissionStep;
  title: string;
  description: string;
  icon: any;
  status: 'pending' | 'granted' | 'denied';
}

export default function PermissionGuide({ visible, onComplete, onClose }: PermissionGuideProps) {
  const [steps, setSteps] = useState<StepState[]>([
    {
      id: 'location',
      title: 'Location Permission',
      description: 'Allow D-Ride to access your precise location for live tracking',
      icon: Navigation,
      status: 'pending',
    },
    {
      id: 'background_location',
      title: 'Background Location',
      description: 'Keep tracking even when the app is minimized or your phone is locked',
      icon: MapPin,
      status: 'pending',
    },
    {
      id: 'gps',
      title: 'GPS Enabled',
      description: 'Make sure high-accuracy GPS is turned on for reliable tracking',
      icon: Globe,
      status: 'pending',
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Receive trip alerts and keep the tracking service alive',
      icon: Bell,
      status: 'pending',
    },
    {
      id: 'battery',
      title: 'Battery Optimization',
      description: 'Exclude D-Ride from battery saving to prevent the service from being stopped',
      icon: Battery,
      status: 'pending',
    },
  ]);

  useEffect(() => {
    if (visible) checkAllPermissions();
  }, [visible]);

  const updateStepStatus = (id: PermissionStep, status: StepState['status']) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  async function checkAllPermissions() {
    if (!Capacitor.isNativePlatform()) {
      onComplete();
      return;
    }

    // 1. Location permission
    try {
      const geoPerm = await Geolocation.checkPermissions();
      if (geoPerm.location === 'granted') {
        updateStepStatus('location', 'granted');
        updateStepStatus('background_location', 'granted');
      }
    } catch {
      // will be handled by user action
    }

    // 2. GPS enabled
    try {
      const locEnabled = await BackgroundLocation.checkLocationEnabled();
      updateStepStatus('gps', locEnabled.enabled ? 'granted' : 'denied');
    } catch {
      // ignore
    }

    // 3. Notifications - use browser Notification API
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        updateStepStatus('notifications', 'granted');
      }
    }

    // 4. Battery optimization
    try {
      const batt = await BackgroundLocation.isBatteryOptimizationDisabled();
      updateStepStatus('battery', batt.disabled ? 'granted' : 'denied');
    } catch {
      // ignore
    }
  }

  async function handleStepAction(step: PermissionStep) {
    switch (step) {
      case 'location':
        try {
          const req = await Geolocation.requestPermissions();
          const granted = req.location === 'granted';
          if (granted) {
            updateStepStatus('location', 'granted');
          }
        } catch {
          updateStepStatus('location', 'denied');
        }
        break;

      case 'background_location':
        try {
          await Geolocation.requestPermissions();
        } catch {
          // ignore
        }
        try {
          const geoPerm = await Geolocation.checkPermissions();
          updateStepStatus('background_location', geoPerm.location === 'granted' ? 'granted' : 'denied');
        } catch {
          updateStepStatus('background_location', 'denied');
        }
        if (BackgroundLocation.openLocationSettings) {
          BackgroundLocation.openLocationSettings().catch(() => {});
        }
        break;

      case 'gps':
        try {
          await BackgroundLocation.openLocationSettings();
          const checkGps = setInterval(async () => {
            try {
              const locEnabled = await BackgroundLocation.checkLocationEnabled();
              if (locEnabled.enabled) {
                updateStepStatus('gps', 'granted');
                clearInterval(checkGps);
              }
            } catch {}
          }, 2000);
          setTimeout(() => clearInterval(checkGps), 60000);
        } catch {
          // ignore
        }
        break;

      case 'notifications':
        if ('Notification' in window) {
          const result = await Notification.requestPermission();
          updateStepStatus('notifications', result === 'granted' ? 'granted' : 'denied');
        }
        break;

      case 'battery':
        try {
          await BackgroundLocation.requestBatteryOptimization();
          const checkBatt = setInterval(async () => {
            try {
              const batt = await BackgroundLocation.isBatteryOptimizationDisabled();
              if (batt.disabled) {
                updateStepStatus('battery', 'granted');
                clearInterval(checkBatt);
              }
            } catch {}
          }, 2000);
          setTimeout(() => clearInterval(checkBatt), 60000);
        } catch {
          // ignore
        }
        break;
    }
  }

  const allGranted = steps.every(s => s.status === 'granted');

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: 16, padding: 24,
        maxWidth: 400, width: '100%', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Setup Location Tracking</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ color: '#666', marginBottom: 20, fontSize: 14 }}>
          Enable all permissions for reliable background location tracking
        </p>

        {steps.map((step) => {
          const Icon = step.icon;
          const isGranted = step.status === 'granted';

          return (
            <div key={step.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 0', borderBottom: '1px solid #f0f0f0',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                backgroundColor: isGranted ? '#e8f5e9' : '#f5f5f5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={20} color={isGranted ? '#2e7d32' : '#666'} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{step.title}</div>
                <div style={{ color: '#888', fontSize: 12 }}>{step.description}</div>
              </div>
              {isGranted ? (
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  backgroundColor: '#2e7d32',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={16} color="white" />
                </div>
              ) : (
                <button onClick={() => handleStepAction(step.id)} style={{
                  padding: '6px 16px', borderRadius: 8, border: '1px solid #1976d2',
                  backgroundColor: 'white', color: '#1976d2', fontSize: 13,
                  fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                  {step.id === 'gps' || step.id === 'battery' ? 'Open Settings' : 'Allow'}
                </button>
              )}
            </div>
          );
        })}

        <button
          disabled={!allGranted}
          onClick={onComplete}
          style={{
            width: '100%', marginTop: 20, padding: '14px 24px',
            borderRadius: 12, border: 'none',
            backgroundColor: allGranted ? '#1976d2' : '#ccc',
            color: 'white', fontSize: 16, fontWeight: 600,
            cursor: allGranted ? 'pointer' : 'not-allowed',
          }}
        >
          {allGranted ? 'Start Tracking' : 'Complete all steps above'}
        </button>
      </div>
    </div>
  );
}
