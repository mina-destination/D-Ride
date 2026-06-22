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
  required: boolean;
}

export default function PermissionGuide({ visible, onComplete, onClose }: PermissionGuideProps) {
  const [requestingAuto, setRequestingAuto] = useState(false);
  const [steps, setSteps] = useState<StepState[]>([
    {
      id: 'location',
      title: 'Location Permission',
      description: 'Allow D-Ride to access your precise location for live tracking',
      icon: Navigation,
      status: 'pending',
      required: true,
    },
    {
      id: 'background_location',
      title: 'Background Location',
      description: 'Choose "Allow all the time" in location settings for background tracking',
      icon: MapPin,
      status: 'pending',
      required: true,
    },
    {
      id: 'gps',
      title: 'GPS Enabled',
      description: 'Make sure high-accuracy GPS is turned on for reliable tracking',
      icon: Globe,
      status: 'pending',
      required: false,
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Receive trip alerts and keep the tracking service alive',
      icon: Bell,
      status: 'pending',
      required: false,
    },
    {
      id: 'battery',
      title: 'Battery Optimization',
      description: 'Exclude D-Ride from battery saving to prevent the service from being stopped',
      icon: Battery,
      status: 'pending',
      required: false,
    },
  ]);

  useEffect(() => {
    if (visible) {
      checkAllPermissions();

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          checkAllPermissions();
        }
      };

      window.addEventListener('focus', checkAllPermissions);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Auto-trigger native flow after a short delay so visual transition finishes
      const timer = setTimeout(() => {
        autoRequestAll();
      }, 800);

      return () => {
        window.removeEventListener('focus', checkAllPermissions);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        clearTimeout(timer);
      };
    }
  }, [visible]);

  const updateStepStatus = (id: PermissionStep, status: StepState['status']) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  async function checkAllPermissions() {
    if (!Capacitor.isNativePlatform()) {
      // Auto-grant steps for web testing fallback
      setSteps(prev => prev.map(s => ({ ...s, status: 'granted' })));
      return;
    }

    // Foreground location using official @capacitor/geolocation
    try {
      const geoPerm = await Geolocation.checkPermissions();
      updateStepStatus('location', geoPerm.location === 'granted' ? 'granted' : 'pending');
    } catch (e) {
      console.error('Error checking foreground location:', e);
    }

    // Background location and notifications using custom plugin
    try {
      const permStatus = await BackgroundLocation.checkPermissions();
      updateStepStatus('background_location', permStatus.backgroundLocation === 'granted' ? 'granted' : 'pending');
      updateStepStatus('notifications', permStatus.notifications === 'granted' ? 'granted' : 'pending');
    } catch (e) {
      console.error('Error checking background/notification permissions:', e);
    }

    // GPS enabled
    try {
      const locEnabled = await BackgroundLocation.checkLocationEnabled();
      updateStepStatus('gps', locEnabled.enabled ? 'granted' : 'denied');
    } catch {
      // ignore
    }

    // Battery optimization
    try {
      const batt = await BackgroundLocation.isBatteryOptimizationDisabled();
      updateStepStatus('battery', batt.disabled ? 'granted' : 'denied');
    } catch {
      // ignore
    }
  }

  async function autoRequestAll() {
    if (!Capacitor.isNativePlatform()) {
      setSteps(prev => prev.map(s => ({ ...s, status: 'granted' })));
      return;
    }

    setRequestingAuto(true);
    try {
      // 1. Foreground Location
      const geoPerm = await Geolocation.checkPermissions();
      if (geoPerm.location !== 'granted') {
        const req = await Geolocation.requestPermissions();
        updateStepStatus('location', req.location === 'granted' ? 'granted' : 'denied');
        if (req.location !== 'granted') {
          setRequestingAuto(false);
          return;
        }
      } else {
        updateStepStatus('location', 'granted');
      }

      // 2. Notifications
      const checkNotif = await BackgroundLocation.checkPermissions();
      if (checkNotif.notifications !== 'granted') {
        const req = await BackgroundLocation.requestPermissions({ permissions: ['notifications'] });
        updateStepStatus('notifications', req.notifications === 'granted' ? 'granted' : 'denied');
      } else {
        updateStepStatus('notifications', 'granted');
      }

      // 3. Background Location (requires foreground location first)
      const checkBg = await BackgroundLocation.checkPermissions();
      if (checkBg.backgroundLocation !== 'granted') {
        const reqBg = await BackgroundLocation.requestPermissions({ permissions: ['backgroundLocation'] });
        updateStepStatus('background_location', reqBg.backgroundLocation === 'granted' ? 'granted' : 'denied');
        
        if (reqBg.backgroundLocation !== 'granted') {
          // Fallback if not granted automatically
          alert('Please select "Permissions" -> "Location" -> "Allow all the time" in the App Settings screen that opens next.');
          await BackgroundLocation.openAppSettings();
        }
      } else {
        updateStepStatus('background_location', 'granted');
      }

      // 4. Battery Optimization
      const batt = await BackgroundLocation.isBatteryOptimizationDisabled();
      if (!batt.disabled) {
        await BackgroundLocation.requestBatteryOptimization();
      } else {
        updateStepStatus('battery', 'granted');
      }

      // 5. GPS Enabled
      const locEnabled = await BackgroundLocation.checkLocationEnabled();
      if (!locEnabled.enabled) {
        await BackgroundLocation.openLocationSettings();
      } else {
        updateStepStatus('gps', 'granted');
      }

    } catch (e) {
      console.error('Error in auto requesting permissions:', e);
    } finally {
      setRequestingAuto(false);
    }
  }

  async function handleStepAction(step: PermissionStep) {
    switch (step) {
      case 'location':
        try {
          const req = await Geolocation.requestPermissions();
          updateStepStatus('location', req.location === 'granted' ? 'granted' : 'denied');
          
          if (req.location === 'granted') {
            const permStatus = await BackgroundLocation.checkPermissions();
            updateStepStatus('background_location', permStatus.backgroundLocation === 'granted' ? 'granted' : 'pending');
          }
        } catch {
          updateStepStatus('location', 'denied');
        }
        break;

      case 'background_location':
        try {
          // Attempt requesting natively so OS directs directly to the location permission screen
          const req = await BackgroundLocation.requestPermissions({ permissions: ['backgroundLocation'] });
          updateStepStatus('background_location', req.backgroundLocation === 'granted' ? 'granted' : 'denied');
          
          if (req.backgroundLocation !== 'granted') {
            // Fallback for older devices/custom ROMs
            alert('Please select "Permissions" -> "Location" -> "Allow all the time" in the App Settings screen that opens next.');
            await BackgroundLocation.openAppSettings();
          }
          
          // Poll permission state periodically to detect when they return
          const checkBg = setInterval(async () => {
            try {
              const permStatus = await BackgroundLocation.checkPermissions();
              if (permStatus.backgroundLocation === 'granted') {
                updateStepStatus('background_location', 'granted');
                clearInterval(checkBg);
              }
            } catch {}
          }, 2000);
          setTimeout(() => clearInterval(checkBg), 60000);
        } catch (e) {
          console.error('Failed to open app settings:', e);
          updateStepStatus('background_location', 'denied');
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
        try {
          const req = await BackgroundLocation.requestPermissions({ permissions: ['notifications'] });
          updateStepStatus('notifications', req.notifications === 'granted' ? 'granted' : 'denied');
        } catch {
          updateStepStatus('notifications', 'denied');
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

  const requiredGranted = steps.filter(s => s.required).every(s => s.status === 'granted');

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
                <div style={{ fontWeight: 500, fontSize: 14 }}>
                  {step.title}
                  {!step.required && (
                    <span style={{ color: '#ff9800', fontSize: 11, fontWeight: 400, marginLeft: 6 }}>
                      (Recommended)
                    </span>
                  )}
                </div>
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
                  {step.id === 'gps' || step.id === 'battery' || step.id === 'background_location' ? 'Open Settings' : 'Allow'}
                </button>
              )}
            </div>
          );
        })}

        {!requiredGranted ? (
          <button
            onClick={autoRequestAll}
            disabled={requestingAuto}
            style={{
              width: '100%', marginTop: 20, padding: '14px 24px',
              borderRadius: 12, border: 'none',
              backgroundColor: '#1976d2',
              color: 'white', fontSize: 16, fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
            }}
          >
            {requestingAuto ? 'Requesting Natively...' : 'Grant All Natively'}
          </button>
        ) : (
          <button
            onClick={onComplete}
            style={{
              width: '100%', marginTop: 20, padding: '14px 24px',
              borderRadius: 12, border: 'none',
              backgroundColor: '#2e7d32',
              color: 'white', fontSize: 16, fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(46, 125, 50, 0.3)',
            }}
          >
            Start Tracking
          </button>
        )}
      </div>
    </div>
  );
}
