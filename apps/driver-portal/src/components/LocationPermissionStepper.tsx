import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { BackgroundLocation } from '../capacitor-plugins/background-location';
import { useTranslation } from '../context/LanguageContext';

interface LocationPermissionStepperProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  blocking?: boolean;
}

interface PermissionChecks {
  locationEnabled: boolean;
  fineLocation: boolean;
  backgroundLocation: boolean;
  notifications: boolean;
  batteryOptimized: boolean; // false means battery optimization is DISABLED (unrestricted)
}

export default function LocationPermissionStepper({
  isOpen,
  onClose,
  onComplete,
  blocking = false,
}: LocationPermissionStepperProps) {
  const { t, language } = useTranslation();
  const [checks, setChecks] = useState<PermissionChecks>({
    locationEnabled: false,
    fineLocation: false,
    backgroundLocation: false,
    notifications: false,
    batteryOptimized: true,
  });
  const [checking, setChecking] = useState(true);
  const [oemManufacturer, setOemManufacturer] = useState<string>('');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    console.log('[DEBUG-STEPPER]', msg);
    setDebugLogs((prev) => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const runAllChecks = async () => {
    if (!Capacitor.isNativePlatform()) {
      setChecking(false);
      return;
    }

    setChecking(true);
    addLog('Running all permission/GPS checks...');
    try {
      // 1. GPS hardware state
      const gps = await BackgroundLocation.checkLocationEnabled();
      addLog(`GPS enabled: ${gps.enabled}`);
      
      // 2. Main permissions
      const perms = await BackgroundLocation.checkPermissions();
      addLog(`Perms: location=${perms.location}, bg=${perms.backgroundLocation}, notif=${perms.notifications}`);
      
      // 3. Battery optimization
      const battery = await BackgroundLocation.isBatteryOptimizationDisabled();
      addLog(`Battery optimization disabled: ${battery.disabled}`);

      // 4. OEM detection
      try {
        const info = await Device.getInfo();
        setOemManufacturer(info.manufacturer?.toLowerCase() || '');
      } catch (err) {
        console.warn('OEM check failed', err);
      }

      setChecks({
        locationEnabled: gps.enabled,
        fineLocation: perms.location === 'granted',
        backgroundLocation: perms.backgroundLocation === 'granted',
        notifications: perms.notifications === 'granted',
        batteryOptimized: !battery.disabled,
      });
    } catch (e: any) {
      console.error('[PermissionStepper] Failed to run permission checks:', e);
      addLog(`Checks failed: ${e?.message || e}`);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runAllChecks();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isCriticalSuccess = checks.fineLocation && 
                            checks.backgroundLocation && 
                            checks.locationEnabled && 
                            (!blocking || !checks.batteryOptimized);
  const isOemKiller = ['xiaomi', 'oppo', 'vivo', 'realme', 'oneplus', 'huawei', 'honor'].some(
    (oem) => oemManufacturer.includes(oem)
  );

  const fixFineLocation = async () => {
    addLog('Click: fixFineLocation');
    try {
      const req = await BackgroundLocation.requestPermissions({ permissions: ['location'] });
      addLog(`Request result: location=${req.location}`);
      if (req.location !== 'granted') {
        addLog('Location not granted. Opening app settings...');
        await BackgroundLocation.openAppSettings();
      }
      runAllChecks();
    } catch (err: any) {
      console.warn('Failed to fix fine location', err);
      addLog(`Error (Location): ${err?.message || err}`);
      window.alert('Error (Location): ' + (err?.message || err));
    }
  };

  const fixBackgroundLocation = async () => {
    addLog('Click: fixBackgroundLocation');
    try {
      const req = await BackgroundLocation.requestPermissions({
        permissions: ['backgroundLocation'],
      });
      addLog(`Request result: backgroundLocation=${req.backgroundLocation}`);
      if (req.backgroundLocation !== 'granted') {
        addLog('BackgroundLocation not granted. Opening app settings...');
        await BackgroundLocation.openAppSettings();
      }
      runAllChecks();
    } catch (err: any) {
      console.warn('Failed to fix background location', err);
      addLog(`Error (Background Location): ${err?.message || err}`);
      window.alert('Error (Background Location): ' + (err?.message || err));
    }
  };

  const fixNotifications = async () => {
    addLog('Click: fixNotifications');
    try {
      const req = await BackgroundLocation.requestPermissions({
        permissions: ['notifications'],
      });
      addLog(`Request result: notifications=${req.notifications}`);
      if (req.notifications !== 'granted') {
        addLog('Notifications not granted. Opening app settings...');
        await BackgroundLocation.openAppSettings();
      }
      runAllChecks();
    } catch (err: any) {
      console.warn('Failed to fix notifications', err);
      addLog(`Error (Notifications): ${err?.message || err}`);
      window.alert('Error (Notifications): ' + (err?.message || err));
    }
  };

  const fixGps = async () => {
    addLog('Click: fixGps');
    try {
      addLog('Opening location settings...');
      await BackgroundLocation.openLocationSettings();
      // Inform driver to refresh once turned on
      setTimeout(runAllChecks, 3000);
    } catch (err: any) {
      console.warn('Failed to open location settings', err);
      addLog(`Error (GPS): ${err?.message || err}`);
      window.alert('Error (GPS): ' + (err?.message || err));
    }
  };

  const fixBattery = async () => {
    addLog('Click: fixBattery');
    try {
      addLog('Requesting battery optimization exemption...');
      await BackgroundLocation.requestBatteryOptimization();
      setTimeout(runAllChecks, 3000);
    } catch (err: any) {
      console.warn('Failed to request battery optimization disable', err);
      addLog(`Error (Battery): ${err?.message || err}`);
      window.alert('Error (Battery): ' + (err?.message || err));
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div
        style={{
          background: '#121212',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '24px',
          width: '100%',
          maxWidth: '460px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          color: '#fff',
          direction: language === 'ar' ? 'rtl' : 'ltr',
          textAlign: language === 'ar' ? 'right' : 'left',
        }}
      >
        <div>
          <h2
            className="title-outfit"
            style={{ fontSize: '20px', fontWeight: 900, margin: '0 0 4px 0', color: 'var(--primary)' }}
          >
            {language === 'ar' ? 'قائمة جاهزية التتبع بالخلفية' : 'Background Tracking Readiness'}
          </h2>
          <p style={{ fontSize: '13px', color: '#a3a3a3', margin: 0 }}>
            {language === 'ar'
              ? 'يرجى إكمال الإعدادات التالية لضمان عدم توقف البث المباشر للرحلة.'
              : 'Complete the following steps to ensure live location tracking remains active during your shift.'}
          </p>
        </div>

        {checking ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '30px 0' }}>
            <span style={{ fontSize: '14px', color: '#a3a3a3' }}>
              {language === 'ar' ? 'جاري التحقق من الصلاحيات...' : 'Verifying device status...'}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* STEP 1: GPS Enabled */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>{checks.locationEnabled ? '✅' : '❌'}</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>
                    {language === 'ar' ? 'خدمات الموقع (GPS)' : 'Location Services (GPS)'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#a3a3a3' }}>
                    {checks.locationEnabled
                      ? (language === 'ar' ? 'مفعلة ونشطة' : 'Enabled and active')
                      : (language === 'ar' ? 'مغلقة - يرجى تشغيلها' : 'Turned off — click to enable')}
                  </div>
                </div>
              </div>
              {!checks.locationEnabled && (
                <button
                  onClick={fixGps}
                  style={{
                    background: 'var(--primary)',
                    color: 'var(--text-on-primary)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  {language === 'ar' ? 'تفعيل' : 'Enable'}
                </button>
              )}
            </div>

            {/* STEP 2: Fine Location */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>{checks.fineLocation ? '✅' : '❌'}</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>
                    {language === 'ar' ? 'صلاحية الموقع الدقيق' : 'Location Accuracy'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#a3a3a3' }}>
                    {checks.fineLocation
                      ? (language === 'ar' ? 'ممنوحة بدقة عالية' : 'Granted high accuracy')
                      : (language === 'ar' ? 'مطلوبة لتتبع الحافلة بدقة' : 'Required for navigation precision')}
                  </div>
                </div>
              </div>
              {!checks.fineLocation && (
                <button
                  onClick={fixFineLocation}
                  style={{
                    background: 'var(--primary)',
                    color: 'var(--text-on-primary)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  {language === 'ar' ? 'منح الصلاحية' : 'Grant'}
                </button>
              )}
            </div>

            {/* STEP 3: Background Location */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>{checks.backgroundLocation ? '✅' : '❌'}</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>
                    {language === 'ar' ? 'موقع الخلفية (السماح طوال الوقت)' : 'Background Location'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#a3a3a3' }}>
                    {checks.backgroundLocation
                      ? (language === 'ar' ? 'يعمل بالخلفية عند إغلاق التطبيق' : 'Granted all the time')
                      : (language === 'ar' ? 'مطلوب لمنع التوقف عند الخروج' : "Set to 'Allow all the time'")}
                  </div>
                </div>
              </div>
              {!checks.backgroundLocation && (
                <button
                  onClick={fixBackgroundLocation}
                  style={{
                    background: 'var(--primary)',
                    color: 'var(--text-on-primary)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  {language === 'ar' ? 'السماح بالخلفية' : 'Allow'}
                </button>
              )}
            </div>

            {/* STEP 4: Notifications (Android 13+) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>{checks.notifications ? '✅' : '⚠️'}</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>
                    {language === 'ar' ? 'إشعارات بث الخدمة' : 'Service Notifications'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#a3a3a3' }}>
                    {checks.notifications
                      ? (language === 'ar' ? 'نشطة ومحمي من الإغلاق' : 'Active foreground badge')
                      : (language === 'ar' ? 'موصى بها لمنع النظام من قتل البث' : 'Highly recommended to protect service')}
                  </div>
                </div>
              </div>
              {!checks.notifications && (
                <button
                  onClick={fixNotifications}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  {language === 'ar' ? 'تفعيل' : 'Enable'}
                </button>
              )}
            </div>

            {/* STEP 5: Battery Optimization */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>{!checks.batteryOptimized ? '✅' : '⚠️'}</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>
                    {language === 'ar' ? 'تحسين البطارية (غير مقيد)' : 'Battery Saver Mode'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#a3a3a3' }}>
                    {!checks.batteryOptimized
                      ? (language === 'ar' ? 'غير مقيد (تتبع مستمر)' : 'Unrestricted background usage')
                      : (language === 'ar' ? 'موصى بتعيينه كـ "غير مقيد"' : 'Set optimization to Unrestricted')}
                  </div>
                </div>
              </div>
              {checks.batteryOptimized && (
                <button
                  onClick={fixBattery}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  {language === 'ar' ? 'تعطيل القيود' : 'Unrestrict'}
                </button>
              )}
            </div>

            {/* OEM Specific warning */}
            {isOemKiller && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  fontSize: '11px',
                  color: '#f59e0b',
                  lineHeight: '1.4',
                }}
              >
                ⚠️ <strong>{oemManufacturer.toUpperCase()} Device Detected:</strong>
                <br />
                {language === 'ar'
                  ? 'يستخدم هذا الهاتف إدارة طاقة شديدة قد تمنع البث بالخلفية. يرجى التأكد من تمويل "التشغيل التلقائي" للتطبيق من إعدادات الحماية بالهاتف.'
                  : 'Your device brand forces aggressive background limits. Please ensure you enable "Autostart" or "Run in background" for D-Ride in security settings.'}
              </div>
            )}
          </div>
        )}

        {/* Visual Logger */}
        <div
          style={{
            marginTop: '8px',
            padding: '8px',
            background: 'rgba(0,0,0,0.4)',
            border: '1px dashed rgba(255,255,255,0.1)',
            borderRadius: '6px',
            fontSize: '10px',
            fontFamily: 'monospace',
            color: '#10b981',
            maxHeight: '80px',
            overflowY: 'auto',
            textAlign: 'left',
            direction: 'ltr',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#a3a3a3' }}>Debug Console Output:</div>
          {debugLogs.length === 0 ? (
            <div style={{ color: '#666' }}>No logs yet (tap any button to debug).</div>
          ) : (
            debugLogs.map((log, i) => <div key={i}>{log}</div>)
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          {!blocking && (
            <button
              onClick={onClose}
              style={{
                flex: 1,
                background: 'transparent',
                color: '#a3a3a3',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '10px',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
          )}
          
          <button
            onClick={onComplete}
            disabled={checking || !isCriticalSuccess}
            style={{
              flex: blocking ? 1 : 2,
              background: isCriticalSuccess ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
              color: isCriticalSuccess ? 'var(--text-on-primary)' : 'rgba(255,255,255,0.3)',
              border: 'none',
              padding: '10px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '13px',
              cursor: isCriticalSuccess ? 'pointer' : 'not-allowed',
            }}
          >
            {blocking 
              ? (language === 'ar' ? 'دخول لوحة القيادة' : 'Enter Dashboard')
              : (language === 'ar' ? 'بدء الوردية' : 'Start Shift')}
          </button>
        </div>
      </div>
    </div>
  );
}
