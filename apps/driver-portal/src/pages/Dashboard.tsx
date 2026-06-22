import { useEffect, useState, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { driverAPI } from '../services/api';
import { socketService } from '../services/socket';
import { parseTicketQr } from '../utils/qr';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Users, 
  ChevronRight, 
  LogOut, 
  Globe, 
  Play, 
  CheckCircle, 
  Navigation, 
  ShieldCheck, 
  QrCode, 
  Camera, 
  Phone, 
  HelpCircle, 
  AlertTriangle,
  Download,
  Bell,
  Trash2,
  Check,
  Lock,
  Unlock
} from 'lucide-react';
import logo from '../assets/d-ride-logo.jpeg';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { Html5Qrcode } from 'html5-qrcode';
import maplibregl from 'maplibre-gl';
import { Capacitor } from '@capacitor/core';
import { BackgroundLocation } from '../capacitor-plugins/background-location';
import { API_URL } from '../services/api';
import 'maplibre-gl/dist/maplibre-gl.css';
import Header from '../components/Header';

// Sound feedback helper
function playChime(isSuccess: boolean) {
  // Haptic feedback via Capacitor Plugins (available at runtime on native)
  try {
    if (Capacitor.isNativePlatform()) {
      const haptics = (Capacitor as any).Plugins?.Haptics;
      if (haptics) {
        if (isSuccess) {
          haptics.notification({ type: 'SUCCESS' });
        } else {
          haptics.impact({ style: 'HEAVY' });
        }
      }
    }
  } catch (e) {
    // haptics not available
  }

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    if (isSuccess) {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1); // A5
      
      gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120.00, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(90.00, ctx.currentTime + 0.4);
      
      gainNode.gain.setValueAtTime(0.18, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    }
  } catch (e) {
    console.warn("Web Audio API sound playback failed", e);
  }
}

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of the earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { t, language, setLanguage, isRtl } = useTranslation();
  const { notifications, markRead, markAllRead, addNotification } = useNotifications();

  // Trips and calendar state
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const activeTripRef = useRef<any>(null);
  useEffect(() => {
    activeTripRef.current = activeTrip;
  }, [activeTrip]);
  const [showAllTrips, setShowAllTrips] = useState(false);
  const [expandUpcoming, setExpandUpcoming] = useState(false);
  
  // Passenger manifest details
  const [manifest, setManifest] = useState<any[]>([]);
  const [manifestLoading, setManifestLoading] = useState(false);
  
  // Passenger visual offboarding state (bookingId -> boolean)
  const [offboardedPassengers, setOffboardedPassengers] = useState<Record<string, boolean>>({});

  // Workflow states
  const [actionLoading, setActionLoading] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [scanStatus, setScanStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const [confirmStatusModal, setConfirmStatusModal] = useState<string | null>(null);
  const lastNotifiedCountRef = useRef<number | null>(null);

  // Notifications & Permissions layout states
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [showSosConfirm, setShowSosConfirm] = useState(false);

  const handleTriggerEmergencyPanic = () => {
    if (!activeTrip) return;
    const lat = currentCoords?.lat || 30.0444;
    const lng = currentCoords?.lng || 31.2357;
    const plateNumber = activeTrip.vehicleId?.plateNumber || activeTrip.vehicleId?.licensePlate || 'ط ج أ ٤٨٢';
    const driverName = user?.name || 'Driver Captain';

    socketService.sendEmergencyPanic({
      tripId: activeTrip._id,
      vehicleId: activeTrip.vehicleId?._id || activeTrip.vehicleId?.id || 'mock-vehicle-123',
      latitude: lat,
      longitude: lng,
      driverName,
      plateNumber,
    });

    addNotification(t('sosButton') + ' 🚨', t('sosSentAlert'));
    playChime(false);

    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new window.Notification(t('sosButton') + ' 🚨', { body: t('sosSentAlert') });
      }
    } catch (e) {
      // ignore
    }
  };

  // Checkpoint arrival state
  const [arrivedCheckpoints, setArrivedCheckpoints] = useState<string[]>([]);

  // Load arrived checkpoints for active trip
  useEffect(() => {
    if (activeTrip?._id) {
      const stored = localStorage.getItem(`dride_arrived_checkpoints_${activeTrip._id}`);
      let initialCheckpoints: string[] = [];
      if (stored) {
        try {
          initialCheckpoints = JSON.parse(stored);
          setArrivedCheckpoints(initialCheckpoints);
        } catch {
          // ignore
        }
      }

      driverAPI.getArrivedCheckpoints(activeTrip._id)
        .then(res => {
          const serverCheckpoints = res || [];
          setArrivedCheckpoints(serverCheckpoints);
          localStorage.setItem(`dride_arrived_checkpoints_${activeTrip._id}`, JSON.stringify(serverCheckpoints));
          
          setTimeout(() => {
            socketService.sendCheckpointUpdate({
              vehicleId: activeTrip.vehicleId?._id || activeTrip.vehicleId?.id || 'mock-vehicle-123',
              arrivedCheckpoints: serverCheckpoints,
            });
          }, 1000);
        })
        .catch(() => {
          if (initialCheckpoints.length > 0) {
            setTimeout(() => {
              socketService.sendCheckpointUpdate({
                vehicleId: activeTrip.vehicleId?._id || activeTrip.vehicleId?.id || 'mock-vehicle-123',
                arrivedCheckpoints: initialCheckpoints,
              });
            }, 1000);
          }
        });
    } else {
      setArrivedCheckpoints([]);
    }
  }, [activeTrip?._id]);

  const toggleCheckpointArrived = (checkpointName: string) => {
    if (!activeTrip) return;
    const sortedCPs = activeTrip.routeId?.checkpoints
      ? [...activeTrip.routeId.checkpoints].sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
      : [];
    const cpIndex = sortedCPs.findIndex((c: any) => c.name === checkpointName);
    if (cpIndex === -1) return;

    const isArrived = arrivedCheckpoints.includes(checkpointName);
    
    if (!isArrived) {
      // 1. Check sequence
      if (cpIndex > 0) {
        const prevCp = sortedCPs[cpIndex - 1];
        if (!arrivedCheckpoints.includes(prevCp.name)) {
          return; // Block silently or UI disabled handles it
        }
      }

      // Check if checkpoint has passenger actions (pickups or dropoffs)
      const dropoffs = manifest.filter(b => 
        (b.dropoffStopId === checkpointName || b.dropoffCheckpoint?.name === checkpointName) && 
        (b.status === 'CONFIRMED' || b.status === 'BOARDED')
      );
      const pickups = manifest.filter(b => 
        (b.pickupStopId === checkpointName || b.pickupCheckpoint?.name === checkpointName) && 
        b.status === 'CONFIRMED'
      );
      const hasPassengers = dropoffs.length > 0 || pickups.length > 0;

      // 2. Check distance (only if the checkpoint has passenger pickups/dropoffs)
      if (hasPassengers) {
        const targetCp = sortedCPs[cpIndex];
        const cpCoords = targetCp.location?.coordinates || targetCp.coordinates;
        if (cpCoords) {
          if (!currentCoords) {
            return;
          }
          const dist = getDistanceInMeters(currentCoords.lat, currentCoords.lng, cpCoords[1], cpCoords[0]);
          if (dist > 200) {
            return;
          }
        }
      }
    }

    let updated: string[];
    if (isArrived) {
      updated = arrivedCheckpoints.filter(name => name !== checkpointName);
    } else {
      updated = [...arrivedCheckpoints, checkpointName];
    }
    setArrivedCheckpoints(updated);
    localStorage.setItem(`dride_arrived_checkpoints_${activeTrip._id}`, JSON.stringify(updated));

    // Emit socket update
    socketService.sendCheckpointUpdate({
      vehicleId: activeTrip.vehicleId?._id || activeTrip.vehicleId?.id || 'mock-vehicle-123',
      arrivedCheckpoints: updated,
    });

    // Add dashboard notification
    addNotification(
      isArrived ? `Checkpoint Cleared` : `Checkpoint Arrived 📍`,
      isArrived 
        ? `Driver marked "${checkpointName}" as not arrived.` 
        : `Driver confirmed arrival at "${checkpointName}".`
    );
  };

  // Map & Telemetry states
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const busMarkerRef = useRef<maplibregl.Marker | null>(null);
  const checkpointMarkersRef = useRef<maplibregl.Marker[]>([]);
  
  const [streetPath, setStreetPath] = useState<[number, number][]>([]);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [lockCenter, setLockCenter] = useState(true);
  
  const geoWatchId = useRef<any>(null);

  // Generate 7 days for the calendar strip (today +/- 3 days)
  const [calendarDates, setCalendarDates] = useState<Date[]>([]);

  // Fetch all driver trips
  async function fetchTrips(autoSelect = false, silent = false) {
    try {
      if (!silent) setLoading(true);
      const data = await driverAPI.getMyTrips();
      const activeUpcomingTrips = (data || [])
        .filter((x: any) => x.status !== 'CANCELLED' && x.status !== 'COMPLETED')
        .sort((a: any, b: any) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());
      setTrips(activeUpcomingTrips);

      const tripCount = activeUpcomingTrips.length;
      if (tripCount > 0) {
        if (lastNotifiedCountRef.current === null) {
          // Summary of all scheduled shifts on first load
          const title = t('upcomingShiftsSummaryTitle');
          const description = t('upcomingShiftsSummaryDesc', { count: tripCount });
          addNotification(title, description);

          // Web browser notification API fallback
          try {
            if ('Notification' in window && Notification.permission === 'granted') {
              new window.Notification(title, { body: description });
            }
          } catch (e) {
            /* ignore */
          }
        } else if (tripCount > lastNotifiedCountRef.current) {
          // Real-time alert when new shifts are added
          const diff = tripCount - lastNotifiedCountRef.current;
          const title = t('newShiftsAssignedTitle');
          const description = t('newShiftsAssignedDesc', { count: diff });
          addNotification(title, description);

          // Web browser notification API fallback
          try {
            if ('Notification' in window && Notification.permission === 'granted') {
              new window.Notification(title, { body: description });
            }
          } catch (e) {
            /* ignore */
          }
        }
      }
      lastNotifiedCountRef.current = tripCount;
      
      // Auto-update active trip if it was already selected
      if (activeTrip) {
        const updated = activeUpcomingTrips.find((x: any) => x._id === activeTrip._id);
        if (updated) {
          setActiveTrip(updated);
        } else {
          setActiveTrip(null);
        }
      } else if (autoSelect && activeUpcomingTrips.length > 0) {
        // Auto-select the first upcoming trip
        handleSelectTrip(activeUpcomingTrips[0]);
      }
    } catch (error) {
      console.error('Failed to load driver trips', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // Fetch manifest for the selected active trip
  async function fetchTripManifest(tripId: string) {
    try {
      setManifestLoading(true);
      const manifestData = await driverAPI.getTripManifest(tripId);
      setManifest(manifestData);
    } catch (error) {
      console.error('Failed to load trip manifest', error);
    } finally {
      setManifestLoading(false);
    }
  }

  // When active trip changes, load its manifest and reset states
  function handleSelectTrip(trip: any) {
    setActiveTrip(trip);
    setScannerActive(false);
    setScanStatus({ type: null, message: '' });
    
    // Stop any ongoing location stream if we switch trips
    stopLocationStream();

    if (trip) {
      fetchTripManifest(trip._id);
      
      // Load OSM Turn-by-Turn coordinates
      if (trip.routeId?.checkpoints && trip.routeId.checkpoints.length >= 2) {
        const coordsString = trip.routeId.checkpoints
          .map((cp: any) => {
            const coords = cp.location?.coordinates || cp.coordinates;
            return `${coords[0]},${coords[1]}`;
          })
          .join(';');
        
        fetch(`https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`)
          .then(res => res.json())
          .then(data => {
            if (data.routes && data.routes.length > 0) {
              const coords = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
              setStreetPath(coords);
            } else if (trip.routeId.path?.coordinates) {
              setStreetPath(trip.routeId.path.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]));
            }
          })
          .catch(err => {
            console.warn("Failed to fetch OSRM route, falling back to static coordinates:", err);
            if (trip.routeId.path?.coordinates) {
              setStreetPath(trip.routeId.path.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]));
            }
          });
      } else if (trip.routeId?.path?.coordinates) {
        setStreetPath(trip.routeId.path.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]));
      }
    } else {
      setManifest([]);
    }
  }

  // Helpers to draw on map
  function drawRoutePolyline() {
    const map = mapRef.current;
    if (!map || streetPath.length === 0) return;

    if (map.getSource('route-path')) {
      map.removeLayer('route-path-layer');
      map.removeSource('route-path');
    }

    map.addSource('route-path', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: streetPath.map(([lat, lng]) => [lng, lat]),
        },
      },
    });

    map.addLayer({
      id: 'route-path-layer-casing',
      type: 'line',
      source: 'route-path',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#b58014',
        'line-width': 8,
        'line-opacity': 0.7,
      },
    });

    map.addLayer({
      id: 'route-path-layer',
      type: 'line',
      source: 'route-path',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#f5b731',
        'line-width': 5,
        'line-opacity': 0.95,
      },
    });
  }

  function drawCheckpointMarkers() {
    const map = mapRef.current;
    if (!map || !activeTrip?.routeId?.checkpoints) return;

    // Clear old ones
    checkpointMarkersRef.current.forEach((m) => m.remove());
    checkpointMarkersRef.current = [];

    activeTrip.routeId.checkpoints.forEach((cp: any, idx: number) => {
      const coords = cp.location?.coordinates || cp.coordinates;
      if (!coords) return;

      const el = document.createElement('div');
      const isStart = cp.type === 'START';
      const isEnd = cp.type === 'END';
      if (isStart) {
        el.className = 'google-maps-start-pin';
      } else if (isEnd) {
        el.className = 'google-maps-dest-pin';
      } else {
        el.className = 'google-maps-stop-pin';
        el.innerText = String(idx);
      }

      const cpName = language === 'ar' ? (cp.nameAr || cp.name) : cp.name;
      const popup = new maplibregl.Popup({ offset: isStart || isEnd ? 15 : 10, closeButton: false }).setHTML(
        `<div style="color:#000; font-size:11px; font-weight:bold; padding:1px 3px;">${cpName}</div>`
      );

      const marker = new maplibregl.Marker({ element: el, anchor: isStart || isEnd ? 'bottom' : 'center' })
        .setLngLat([coords[0], coords[1]])
        .setPopup(popup)
        .addTo(map);

      marker.togglePopup();
      checkpointMarkersRef.current.push(marker);
    });
  }

  async function requestAllPermissionsNatively(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return true;
    }

    // 1. Foreground Location (Critical)
    try {
      const geoPerm = await Geolocation.checkPermissions();
      if (geoPerm.location !== 'granted') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted') {
          const tryAgain = window.confirm(
            "Location permission is required to track your shifts and live route. Please allow location access in your phone settings."
          );
          if (tryAgain) {
            await BackgroundLocation.openAppSettings();
          }
          return false;
        }
      }
    } catch (e) {
      console.error('Critical: Failed to request foreground location:', e);
      return false; // Cannot proceed without foreground location
    }

    // 2. Notifications (Non-blocking)
    try {
      const checkNotif = await BackgroundLocation.checkPermissions();
      if (checkNotif.notifications !== 'granted') {
        await BackgroundLocation.requestPermissions({ permissions: ['notifications'] });
      }
    } catch (e) {
      console.warn('Non-critical: Failed to request notifications natively:', e);
    }

    // 3. Background Location (Non-blocking fallback to keep app usable)
    try {
      const checkBg = await BackgroundLocation.checkPermissions();
      if (checkBg.backgroundLocation !== 'granted') {
        const proceed = window.confirm(
          "To track your bus route when the app is minimized or the screen is off, D-Ride needs background location. On the next screen, please choose 'Allow all the time'."
        );
        if (proceed) {
          const reqBg = await BackgroundLocation.requestPermissions({ permissions: ['backgroundLocation'] });
          if (reqBg.backgroundLocation !== 'granted') {
            const openSettings = window.confirm(
              "Background location permission was not granted. Without it, tracking will stop when you minimize the app. Would you like to open App Settings to set location access to 'Allow all the time'?"
            );
            if (openSettings) {
              await BackgroundLocation.openAppSettings();
            }
          }
        }
      }
    } catch (e) {
      console.warn('Non-critical: Failed to request background location natively:', e);
    }

    // 4. GPS Enabled Check (Non-blocking)
    try {
      const gps = await BackgroundLocation.checkLocationEnabled();
      if (!gps.enabled) {
        const enableGps = window.confirm(
          "Your phone's GPS / Location Services are turned off. Please turn them on for high-accuracy tracking. Open Location Settings?"
        );
        if (enableGps) {
          await BackgroundLocation.openLocationSettings();
        }
      }
    } catch (e) {
      console.warn('Non-critical: Failed to check GPS status:', e);
    }

    // 5. Battery Optimization (Non-blocking)
    try {
      const checkBatt = await BackgroundLocation.isBatteryOptimizationDisabled();
      if (!checkBatt.disabled) {
        const optimize = window.confirm(
          "For uninterrupted tracking, exclude D-Ride from battery saver optimizations. Open Settings?"
        );
        if (optimize) {
          await BackgroundLocation.requestBatteryOptimization();
        }
      }
    } catch (e) {
      console.warn('Non-critical: Failed to request battery optimization ignore:', e);
    }

    return true;
  }

  // Location Telemetry Broadcasting
  async function startLocationStream() {
    if (isStreaming) return;
    if (!activeTripRef.current) {
      console.log('startLocationStream: Deferred starting tracking, no active trip selected.');
      return;
    }
    const nativeSuccess = await requestAllPermissionsNatively();
    if (nativeSuccess) {
      triggerRealGPS();
    }
  }

  async function triggerRealGPS() {
    try {
      const permStatus = await Geolocation.checkPermissions();
      if (permStatus.location !== 'granted') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted') {
          setGpsError(t('gpsNotAvailable'));
          return;
        }
      }
    } catch (err) {
      console.warn('Native Geolocation permission request failed, using browser fallback:', err);
    }

    setIsStreaming(true);
    setGpsError(null);
    localStorage.setItem('dride_gps_permitted', 'true');

    if (Capacitor.isNativePlatform()) {
      const token = localStorage.getItem('dride_driver_token') || '';
      const vehicleId = activeTripRef.current?.vehicleId?._id || activeTripRef.current?.vehicleId?.id || '';
      BackgroundLocation.start({
        apiUrl: API_URL,
        token,
        vehicleId,
        driverId: user?._id || '',
      }).catch(err => console.warn('Failed to start background location:', err));
    }

    const watchOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    };

    const handleSuccess = (lat: number, lng: number, headingVal?: number | null) => {
      setCurrentCoords({ lat, lng });
      if (headingVal != null) {
        setHeading(headingVal);
      }
      socketService.sendLocation({
        vehicleId: activeTripRef.current?.vehicleId?._id || activeTripRef.current?.vehicleId?.id || 'mock-vehicle-123',
        driverId: user?._id || 'mock-driver-123',
        longitude: lng,
        latitude: lat,
        heading: headingVal ?? null,
      });
    };

    const handleFailure = (errorMsg: string) => {
      console.warn('GPS failed:', errorMsg);
      setGpsError(t('gpsNotAvailable'));
      setIsStreaming(false);
    };

    if (Capacitor.isNativePlatform()) {
      try {
        const watchId = await Geolocation.watchPosition(
          watchOptions,
          (position, err) => {
            if (err) {
              handleFailure(err.message || 'Native Geolocation error');
              return;
            }
            if (position?.coords) {
              handleSuccess(
                position.coords.latitude,
                position.coords.longitude,
                position.coords.heading
              );
            } else {
              handleFailure('No coordinates from native GPS');
            }
          }
        );
        geoWatchId.current = watchId;
      } catch (err: any) {
        handleFailure(err.message || 'Failed to watch native position');
      }
    } else {
      if ('geolocation' in navigator) {
        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            handleSuccess(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.heading
            );
          },
          (error) => {
            handleFailure(error.message);
          },
          watchOptions
        );
        geoWatchId.current = watchId;
      } else {
        setGpsError(t('geoNotSupported'));
        setIsStreaming(false);
      }
    }
  }

  function stopLocationStream() {
    if (geoWatchId.current !== null) {
      if (Capacitor.isNativePlatform()) {
        Geolocation.clearWatch({ id: geoWatchId.current });
      } else {
        navigator.geolocation.clearWatch(geoWatchId.current);
      }
      geoWatchId.current = null;
    }
    if (Capacitor.isNativePlatform()) {
      BackgroundLocation.stop().catch(err => console.warn('Failed to stop background location:', err));
    }
    setIsStreaming(false);
    setHeading(0);
  }



  // Status transitions
  async function handleUpdateTripStatus(newStatus: string) {
    if (!activeTrip) return;
    try {
      setActionLoading(true);
      await driverAPI.updateTripStatus(activeTrip._id, newStatus);
      
      // Update local state
      const updatedTrip = { ...activeTrip, status: newStatus };
      setActiveTrip(updatedTrip);
      
      if (newStatus === 'COMPLETED') {
        stopLocationStream();
      }

      await fetchTrips();
    } catch (error) {
      console.error(error);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCheckInPassenger(bookingId: string) {
    try {
      setActionLoading(true);
      await driverAPI.checkInPassenger(bookingId);
      playChime(true);
      await fetchTripManifest(activeTrip._id);
      fetchTrips();
    } catch (error) {
      playChime(false);
      console.error(error);
    } finally {
      setActionLoading(false);
    }
  }

  // Haptic feedback on new notification arrival (native mobile)
  const prevNotifCount = useRef(notifications.length);
  useEffect(() => {
    if (notifications.length > prevNotifCount.current && Capacitor.isNativePlatform()) {
      try {
        const haptics = (Capacitor as any).Plugins?.Haptics;
        if (haptics) {
          haptics.impact({ style: 'MEDIUM' });
        }
      } catch (e) {
        // haptics not available
      }
    }
    prevNotifCount.current = notifications.length;
  }, [notifications.length]);
  
  useEffect(() => {
    const dates: Date[] = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    setCalendarDates(dates);
  }, []);



  // Connect socket on mount, disconnect on unmount
  useEffect(() => {
    socketService.connect();
    fetchTrips(true);
    
    // Request notification permission if not yet granted/denied
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch((err) => {
        console.warn("Failed to request notification permission:", err);
      });
    }

    return () => {
      stopLocationStream();
      socketService.disconnect();
    };
  }, []);

  // Listen to WebSocket push updates for checkpoints & status overrides
  useEffect(() => {
    const handleCheckpointUpdate = (data: any) => {
      const activeVehicleId = activeTrip?.vehicleId?._id || activeTrip?.vehicleId?.id;
      if (activeTrip && activeVehicleId && data.vehicleId === activeVehicleId) {
        console.log('Real-time checkpoint update received:', data.arrivedCheckpoints);
        setArrivedCheckpoints(data.arrivedCheckpoints);
        localStorage.setItem(`dride_arrived_checkpoints_${activeTrip._id}`, JSON.stringify(data.arrivedCheckpoints));
      }
    };

    const handleTripStatusUpdate = (data: any) => {
      if (activeTrip && (data.tripId === activeTrip._id || data.tripId === activeTrip.id)) {
        console.log('Real-time trip status update received:', data.status);
        fetchTrips(false, true);
      }
    };

    if (socketService.socket) {
      socketService.socket.on('checkpointUpdate', handleCheckpointUpdate);
      socketService.socket.on('tripStatusUpdate', handleTripStatusUpdate);
    }

    return () => {
      if (socketService.socket) {
        socketService.socket.off('checkpointUpdate', handleCheckpointUpdate);
        socketService.socket.off('tripStatusUpdate', handleTripStatusUpdate);
      }
    };
  }, [activeTrip?._id, activeTrip?.vehicleId?._id, activeTrip?.vehicleId?.id, socketService.socket]);

  // Clean up tracking on unmount
  useEffect(() => {
    return () => {
      stopLocationStream();
    };
  }, []);

  // Periodically refresh trips and active manifest silently (always refreshed)
  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Refresh trips list silently
      fetchTrips(false, true);
      
      // 2. If trip manifest is active, refresh manifest silently too
      if (activeTrip && (activeTrip.status === 'BOARDING' || activeTrip.status === 'IN_TRANSIT')) {
        driverAPI.getTripManifest(activeTrip._id).then((data) => {
          setManifest(data);
        }).catch(console.error);
      }
    }, 6000); // every 6s

    return () => clearInterval(interval);
  }, [activeTrip?._id, activeTrip?.status]);



  // QR Scanner Effect
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    if (scannerActive && activeTrip) {
      html5QrCode = new Html5Qrcode("qr-reader-inline");
      html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 }
        },
        async (decodedText: string) => {
          try {
            if (html5QrCode) {
              await html5QrCode.stop().catch(console.error);
            }
            setScannerActive(false);

            let parsed;
            try {
              parsed = parseTicketQr(decodedText);
            } catch (err) {
              setScanStatus({ type: 'error', message: t('invalidQrStructure') });
              playChime(false);
              return;
            }

            // Enforce pickup checkpoint arrival check in IN_TRANSIT
            if (activeTrip.status === 'IN_TRANSIT') {
              const booking = manifest.find((b: any) => b._id === parsed.bookingId);
              if (booking) {
                const pickupStopName = booking.pickupStopId || booking.pickupCheckpoint?.name;
                if (pickupStopName && !arrivedCheckpoints.includes(pickupStopName)) {
                  setScanStatus({ type: 'error', message: t('arriveStopFirst') });
                  playChime(false);
                  return;
                }
              }
            }

            setActionLoading(true);
            setScanStatus({ type: null, message: '' });

            await driverAPI.verifyTicket(parsed.bookingId, parsed.token);
            setScanStatus({ type: 'success', message: t('passengerCheckedInSuccess') });
            playChime(true);

            // Reload manifest and trips
            await fetchTripManifest(activeTrip._id);
            fetchTrips();
          } catch (err: any) {
            console.error(err);
            setScanStatus({ 
              type: 'error', 
              message: err.message || t('verificationFailed') 
            });
            playChime(false);
          } finally {
            setActionLoading(false);
          }
        },
        () => {}
      ).catch((err: any) => {
        console.error("Failed to start QR scanner:", err);
        setScanStatus({ type: 'error', message: t('cameraPermissionDenied') });
        setScannerActive(false);
      });
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [scannerActive, activeTrip?._id]);

  // Map Initialization Effect
  useEffect(() => {
    if (!mapContainerRef.current || !activeTrip || activeTrip.status !== 'IN_TRANSIT') return;
    
    // Cleanup old map if it exists
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const initCenter: [number, number] = currentCoords
      ? [currentCoords.lng, currentCoords.lat]
      : [31.2357, 30.0444]; // Cairo default

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: initCenter,
      zoom: 14,
      attributionControl: false,
    });

    // Suppress missing sprite image warnings by providing dummy transparent images
    map.on('styleimagemissing', (e) => {
      const width = 16;
      const height = 16;
      const data = new Uint8Array(width * height * 4); // transparent pixels
      if (!map.hasImage(e.id)) {
        map.addImage(e.id, { width, height, data });
      }
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    // Draw route path and add checkpoint markers once style is loaded
    map.on('load', () => {
      drawRoutePolyline();
      drawCheckpointMarkers();
    });

    // Start streaming automatically when map loads in IN_TRANSIT
    startLocationStream();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      stopLocationStream();
    };
  }, [activeTrip?._id, activeTrip?.status === 'IN_TRANSIT']);



  // Update bus marker position on coords change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentCoords) return;

    const rotation = heading !== undefined && heading !== null ? heading : 0;
    const markerColor = '#F5B731'; // Gold brand color
    const svgContent = `
      <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.35));">
        <circle cx="24" cy="24" r="20" fill="${markerColor}" fill-opacity="0.2" />
        <circle cx="24" cy="24" r="14" fill="${markerColor}" stroke="#1e293b" stroke-width="2.5" />
        <g id="vehicle-chevron" transform="translate(24, 24) rotate(${rotation}) translate(-24, -24)">
          <path d="M24 13L30 29L24 26L18 29L24 13Z" fill="#FFFFFF" stroke-linejoin="round" />
        </g>
      </svg>
    `;

    if (!busMarkerRef.current) {
      const el = document.createElement('div');
      el.style.cssText = 'width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer;';
      el.innerHTML = svgContent;

      busMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([currentCoords.lng, currentCoords.lat])
        .addTo(map);
    } else {
      busMarkerRef.current.setLngLat([currentCoords.lng, currentCoords.lat]);
      const el = busMarkerRef.current.getElement();
      const chevron = el.querySelector('#vehicle-chevron');
      if (chevron) {
        chevron.setAttribute('transform', `translate(24, 24) rotate(${rotation}) translate(-24, -24)`);
      }
    }

    if (lockCenter) {
      map.flyTo({ center: [currentCoords.lng, currentCoords.lat], duration: 500 });
    }
  }, [currentCoords, lockCenter, heading]);



  const toggleOffboard = (bookingId: string) => {
    setOffboardedPassengers(prev => ({
      ...prev,
      [bookingId]: !prev[bookingId]
    }));
  };

  // Trips are already filtered to only include active/upcoming ones and sorted chronologically
  const filteredTrips = expandUpcoming ? trips : trips.slice(0, 1);

  // Reusable trip card renderer
  const renderTripCard = (trip: any) => {
    const isSelected = activeTrip?._id === trip._id;
    const routeName = trip.routeId?.name || t('assignedRoute');
    const timeStr = new Date(trip.departureTime).toLocaleTimeString(language === 'ar' ? 'ar-EG' : undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
    const tripDate = new Date(trip.departureTime);
    const isToday = tripDate.toDateString() === new Date().toDateString();

    return (
      <div
        key={trip._id}
        className={`glass-card interactive ${isSelected ? 'active-glow' : ''}`}
        onClick={() => handleSelectTrip(trip)}
        style={{ 
          cursor: 'pointer',
          borderColor: isSelected ? 'rgba(245, 183, 49, 0.6)' : undefined,
          background: isSelected ? 'rgba(22, 22, 40, 0.95)' : undefined,
          boxShadow: isSelected ? '0 8px 24px rgba(245, 183, 49, 0.15)' : undefined
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <span className={`status-tag ${trip.status.toLowerCase().replace('_', '-')}`}>
            {trip.status}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <Clock size={13} />
            <span>{timeStr}</span>
          </div>
        </div>

        <h4 className="title-outfit" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{routeName}</span>
        </h4>

        {showAllTrips && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CalendarIcon size={12} />
            <span>
              {tripDate.toLocaleDateString(language === 'ar' ? 'ar-EG' : undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              {isToday && <span style={{ color: 'var(--primary)', fontWeight: 600 }}> ({isRtl ? 'اليوم' : 'Today'})</span>}
            </span>
          </div>
        )}

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          paddingTop: '8px',
          fontSize: '12px',
          color: 'var(--text-secondary)' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Users size={14} style={{ color: 'var(--text-muted)' }} />
            <span>{t('bookedCount', { booked: trip.bookedSeats, available: trip.availableSeats })}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', color: isSelected ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 600, gap: '2px' }}>
            <span>{isSelected ? t('activeTrip') : t('view')}</span>
            <ChevronRight size={14} style={{ transform: isRtl ? 'rotate(180deg)' : 'none', display: isSelected ? 'none' : 'block' }} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container fade-in-up">
      {/* Top Header */}
      <Header 
        showNotifications={true} 
        onNotificationClick={() => setNotificationDrawerOpen(true)} 
      />

      <div className="content-container">
        {/* Android App Download Banner */}
        {!Capacitor.isNativePlatform() && (
          <div className="glass-card" style={{
            background: 'linear-gradient(135deg, rgba(245, 183, 49, 0.15) 0%, rgba(22, 22, 40, 0.95) 100%)',
            borderColor: 'rgba(245, 183, 49, 0.3)',
            padding: '16px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{ flex: 1 }}>
              <h4 className="title-outfit" style={{ fontSize: '14px', margin: '0 0 4px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📱</span> {t('downloadDriverApp')}
              </h4>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                {t('downloadDriverAppDesc')}
              </p>
            </div>
            <a
              href="/dride-driver.apk"
              download="dride-driver.apk"
              className="btn btn-primary"
              style={{
                fontSize: '12px',
                height: '36px',
                padding: '0 16px',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                textDecoration: 'none',
                background: 'var(--primary)',
                color: 'var(--text-on-primary)',
                borderRadius: '8px',
                fontWeight: 700
              }}
            >
              <Download size={14} />
              {t('downloadApkBtn')}
            </a>
          </div>
        )}

        {/* SECTION 2: Upcoming Shifts / next trip list */}
        <div style={{ marginBottom: '24px' }}>
          <h4 className="section-title">
            <CalendarIcon size={16} style={{ color: 'var(--primary)' }} />
            {t('upcomingShiftsTitle')}
            <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 'auto', marginRight: 'auto' }}>
              {trips.length} {trips.length === 1 ? (isRtl ? 'رحلة' : 'trip') : (isRtl ? 'رحلات' : 'trips')}
            </span>
          </h4>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '30px 0' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('loadingAssignments')}</span>
            </div>
          ) : trips.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0' }}>
                {t('noTripsFound')}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredTrips.map((trip) => renderTripCard(trip))}
              
              {trips.length > 1 && (
                <button
                  onClick={() => setExpandUpcoming(!expandUpcoming)}
                  className="btn btn-secondary btn-block"
                  style={{
                    marginTop: '8px',
                    fontSize: '13px',
                    height: '42px',
                    fontWeight: 600,
                    borderColor: 'rgba(245, 183, 49, 0.25)',
                    background: 'rgba(245, 183, 49, 0.04)',
                    color: 'var(--primary)'
                  }}
                >
                  {expandUpcoming ? t('hideNextTrips') : t('showNextTrips')}
                </button>
              )}
            </div>
          )}
        </div>

        {activeTrip ? (
          <>
            {/* Divider */}
            <div className="dashboard-divider" />

            {/* Selected active trip details header */}
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 700, letterSpacing: '0.05em' }}>
                {t('activeTrip')}
              </span>
              <h3 className="title-outfit" style={{ fontSize: '18px', color: 'var(--text-primary)', margin: '2px 0 0 0' }}>
                {activeTrip.routeId?.name || t('assignedRoute')}
              </h3>
            </div>

            {/* SECTION 3: Start Trip Button (Scheduled Status) */}
            {activeTrip.status === 'SCHEDULED' && (() => {
              const depTime = new Date(activeTrip.departureTime).getTime();
              const now = Date.now();
              const diffMinutes = Math.ceil((depTime - now) / 60000);
              const canStart = diffMinutes <= 60;

              return (
                <div style={{ marginBottom: '20px' }}>
                  <button
                    className="btn btn-primary btn-block"
                    style={{ 
                      height: '52px', 
                      fontSize: '15px',
                      opacity: canStart ? 1 : 0.6,
                      cursor: canStart ? 'pointer' : 'not-allowed',
                      background: canStart ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                      border: canStart ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: canStart ? '#000' : 'var(--text-muted)'
                    }}
                    onClick={() => {
                      if (canStart) {
                        setConfirmStatusModal('BOARDING');
                      }
                    }}
                    disabled={actionLoading || !canStart}
                  >
                    <Play size={18} fill="currentColor" />
                    {t('openBoardingGate')}
                  </button>
                  {!canStart && (
                    <div style={{
                      marginTop: '8px',
                      fontSize: '0.78rem',
                      color: '#f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      justifyContent: 'center',
                      background: 'rgba(245, 158, 11, 0.08)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                      textAlign: 'center'
                    }}>
                      <span>⚠️</span>
                      <span>
                        {isRtl 
                          ? `يمكنك بدء الرحلة قبل موعدها بساعة كحد أقصى (المتبقي: ${diffMinutes} دقيقة)` 
                          : `You can start the trip at most 1 hour before departure (Scheduled in ${diffMinutes} mins)`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* SECTION 4: Boarding Gate - QR Scanner & Passenger Manifest */}
            {(() => {
              const depTime = new Date(activeTrip.departureTime).getTime();
              const now = Date.now();
              const minutesUntilDeparture = Math.ceil((depTime - now) / 60000);
              const isWithinOneHour = minutesUntilDeparture <= 60 && minutesUntilDeparture > -120;
              const showBoardingGate = activeTrip.status === 'BOARDING' || (activeTrip.status === 'SCHEDULED' && isWithinOneHour);
              
              if (!showBoardingGate) return null;
              
              return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                
                {/* QR Scanner Panel */}
                <div className="glass-card" style={{ background: 'var(--surface-elevated)', padding: '16px' }}>
                  <h4 className="section-title" style={{ margin: 0 }}>
                    <QrCode size={16} style={{ color: 'var(--primary)' }} />
                    {t('qrScannerEngine')}
                  </h4>
                  
                  {scanStatus.type && (
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      margin: '12px 0',
                      fontSize: '13px',
                      fontWeight: 600,
                      background: scanStatus.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                      color: scanStatus.type === 'success' ? 'var(--success)' : '#ef4444',
                      border: `1px solid ${scanStatus.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
                    }}>
                      {scanStatus.message}
                    </div>
                  )}

                  {scannerActive ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%', marginTop: '12px' }}>
                      <div style={{ position: 'relative', width: '100%', maxWidth: '260px', height: '240px', borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--border)' }}>
                        <div id="qr-reader-inline" style={{ width: '100%', height: '100%' }} />

                        {/* Scanner overlay effect */}
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '2px',
                          background: 'var(--primary)',
                          boxShadow: '0 0 10px var(--primary)',
                          zIndex: 10,
                          animation: 'laser-scan 2s linear infinite',
                          pointerEvents: 'none'
                        }} />

                        {/* Corners */}
                        <div style={{ position: 'absolute', top: '10px', left: '10px', width: '12px', height: '12px', borderLeft: '2px solid var(--primary)', borderTop: '2px solid var(--primary)', zIndex: 10 }} />
                        <div style={{ position: 'absolute', top: '10px', right: '10px', width: '12px', height: '12px', borderRight: '2px solid var(--primary)', borderTop: '2px solid var(--primary)', zIndex: 10 }} />
                        <div style={{ position: 'absolute', bottom: '10px', left: '10px', width: '12px', height: '12px', borderLeft: '2px solid var(--primary)', borderBottom: '2px solid var(--primary)', zIndex: 10 }} />
                        <div style={{ position: 'absolute', bottom: '10px', right: '10px', width: '12px', height: '12px', borderRight: '2px solid var(--primary)', borderBottom: '2px solid var(--primary)', zIndex: 10 }} />
                      </div>
                      
                      <button 
                        className="btn btn-secondary btn-block" 
                        onClick={() => setScannerActive(false)}
                        style={{ maxWidth: '260px', padding: '10px' }}
                      >
                        {t('closeCamera')}
                      </button>

                      <style>{`
                        @keyframes laser-scan {
                          0% { top: 10%; }
                          50% { top: 90%; }
                          100% { top: 10%; }
                        }
                      `}</style>
                    </div>
                  ) : (
                    <button 
                      className="btn btn-primary btn-block"
                      style={{ marginTop: '12px', height: '46px' }}
                      onClick={() => {
                        setScanStatus({ type: null, message: '' });
                        setScannerActive(true);
                      }}
                      disabled={actionLoading || activeTrip.status !== 'BOARDING'}
                    >
                      <Camera size={16} />
                      {activeTrip.status !== 'BOARDING' 
                        ? t('boardingGateClosed') 
                        : t('scanTicketQr')}
                    </button>
                  )}
                </div>

                {/* Passenger List Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <h4 className="section-title" style={{ margin: 0 }}>
                    <Users size={16} style={{ color: 'var(--primary)' }} />
                    {t('passengerList', { count: manifest.filter(b => b.status !== 'CANCELLED').length })}
                  </h4>
                </div>

                {/* Passenger Manifest */}
                {manifestLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Loading...</span>
                  </div>
                ) : manifest.length === 0 ? (
                  <div className="glass-card" style={{ textAlign: 'center', padding: '24px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{t('noPassengersBooked')}</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {manifest.filter(b => b.status !== 'CANCELLED').map((booking) => {
                      const passenger = booking.userId || {};
                      const name = passenger.name || 'Passenger';
                      const phone = passenger.phone || '';
                      const seats = booking.seatNumbers?.join(', ') || 'N/A';
                      const isBoarded = booking.status === 'BOARDED';

                      return (
                        <div key={booking._id} className="glass-card" style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                              <h5 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                                {booking.boardingNumber && (
                                  <span style={{
                                    background: 'rgba(245, 183, 49, 0.12)',
                                    color: 'var(--primary)',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    fontSize: '9px',
                                    fontWeight: 700,
                                    flexShrink: 0
                                  }}>
                                    #{booking.boardingNumber}
                                  </span>
                                )}
                              </h5>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                  {t('seatsAssigned')} <strong>#{seats}</strong>
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                              {phone && (
                                <a 
                                  href={`tel:${phone}`}
                                  className="btn-call"
                                  title={t('callPassenger')}
                                >
                                  <Phone size={15} fill="currentColor" />
                                </a>
                              )}

                              {isBoarded ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontWeight: 700, fontSize: '12px' }}>
                                  <ShieldCheck size={16} />
                                  <span>{t('onBoard')}</span>
                                </div>
                              ) : (
                                <button
                                  className="btn btn-secondary"
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    borderColor: 'var(--primary)',
                                    height: '32px'
                                  }}
                                  onClick={() => handleCheckInPassenger(booking._id)}
                                  disabled={actionLoading || activeTrip.status !== 'BOARDING'}
                                >
                                  {t('checkInBtn')}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              );
            })()}

            {/* SECTION 5: Start Driving Button (Boarding Status) */}
            {activeTrip.status === 'BOARDING' && (
              <div style={{ marginBottom: '24px' }}>
                <button
                  className="btn btn-primary btn-block"
                  style={{ height: '52px', fontSize: '15px' }}
                  onClick={() => setConfirmStatusModal('IN_TRANSIT')}
                  disabled={actionLoading}
                >
                  <Navigation size={18} fill="currentColor" />
                  {t('startDriving')}
                </button>
              </div>
            )}

            {/* SECTION 6: Live Map (In Transit Status) */}
            {activeTrip.status === 'IN_TRANSIT' && (
              <div style={{ marginBottom: '20px' }}>
                <h4 className="section-title">
                  <Navigation size={16} style={{ color: 'var(--primary)' }} />
                  {t('activeRouteLabel')}
                </h4>

                <div style={{ position: 'relative', width: '100%' }}>
                  <div className="embedded-map-container" ref={mapContainerRef} />
                  
                  {/* Floating SOS Panic Button */}
                  <button
                    onClick={() => setShowSosConfirm(true)}
                    className="btn-sos-floating"
                    title={t('sosButton')}
                  >
                    {t('sosButton')}
                  </button>

                  {currentCoords && (
                    <button
                      onClick={() => setLockCenter(!lockCenter)}
                      style={{
                        position: 'absolute',
                        bottom: '12px',
                        right: '12px',
                        zIndex: 100,
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'rgba(10, 14, 23, 0.85)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: lockCenter ? 'var(--primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        outline: 'none',
                        transition: 'all 0.2s ease'
                      }}
                      title={lockCenter ? 'Unlock View' : 'Lock View'}
                    >
                      {lockCenter ? <Lock size={16} /> : <Unlock size={16} />}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 6b: Route Checkpoints Timeline Checklist (In Transit Status) */}
            {activeTrip.status === 'IN_TRANSIT' && activeTrip.routeId?.checkpoints && (() => {
              const sortedCPs = activeTrip.routeId.checkpoints
                ? [...activeTrip.routeId.checkpoints].sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                : [];
              
              const allCheckpointsArrived = sortedCPs.length > 0 && sortedCPs.every((cp: any) => arrivedCheckpoints.includes(cp.name));
              const allBoardedOffboarded = manifest.every((booking: any) => {
                if (booking.status === 'BOARDED') {
                  return !!offboardedPassengers[booking._id];
                }
                return true;
              });
              const canCompleteTrip = allCheckpointsArrived && allBoardedOffboarded;

              return (
                <>
                  <div style={{ marginBottom: '24px' }}>
                    <h4 className="section-title">
                      <MapPin size={16} style={{ color: 'var(--primary)' }} />
                      {t('stopsTimeline')}
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 16px' }}>
                      {sortedCPs.map((cp: any, index: number) => {
                        const isArrived = arrivedCheckpoints.includes(cp.name);
                        
                        // Sequence validation: Must arrive at previous stop first
                        const isPrevArrived = index === 0 || arrivedCheckpoints.includes(sortedCPs[index - 1].name);
                        
                        // Bookings for pickups/dropoffs at this specific checkpoint
                        const dropoffs = manifest.filter(b => 
                          (b.dropoffStopId === cp.name || b.dropoffCheckpoint?.name === cp.name) && 
                          (b.status === 'CONFIRMED' || b.status === 'BOARDED')
                        );
                        const pickups = manifest.filter(b => 
                          (b.pickupStopId === cp.name || b.pickupCheckpoint?.name === cp.name) && 
                          b.status === 'CONFIRMED'
                        );
                        const hasPassengers = dropoffs.length > 0 || pickups.length > 0;

                        // Proximity check: Must be within 200m
                        const cpCoords = cp.location?.coordinates || cp.coordinates;
                        const distance = currentCoords && cpCoords
                          ? getDistanceInMeters(currentCoords.lat, currentCoords.lng, cpCoords[1], cpCoords[0])
                          : null;
                        const isWithinRange = distance !== null && distance <= 200;
                        
                        // Arrived button validation: If no passengers, driver can mark arrived directly (skip distance check)
                        const isActionable = isArrived || (isPrevArrived && (!hasPassengers || isWithinRange));

                        return (
                          <div key={cp.name || index} style={{ 
                            display: 'flex', 
                            gap: '14px', 
                            position: 'relative',
                            paddingBottom: index === sortedCPs.length - 1 ? 0 : '20px'
                          }}>
                            {/* Timeline vertical line */}
                            {index !== sortedCPs.length - 1 && (
                              <>
                                {/* Glowing neon blur layer */}
                                <div style={{
                                  position: 'absolute',
                                  left: isRtl ? 'auto' : '10px',
                                  right: isRtl ? '10px' : 'auto',
                                  top: '28px',
                                  bottom: 0,
                                  width: '6px',
                                  background: isArrived ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                                  filter: 'blur(2px)',
                                  zIndex: 1
                                }} />
                                {/* Main line */}
                                <div style={{
                                  position: 'absolute',
                                  left: isRtl ? 'auto' : '12px',
                                  right: isRtl ? '12px' : 'auto',
                                  top: '28px',
                                  bottom: 0,
                                  width: '2px',
                                  background: isArrived ? 'var(--success)' : 'rgba(255, 255, 255, 0.08)',
                                  zIndex: 1
                                }} />
                              </>
                            )}

                            {/* Checkpoint order marker */}
                            <div 
                              onClick={() => isActionable && toggleCheckpointArrived(cp.name)}
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                background: isArrived ? 'var(--success)' : 'rgba(18, 22, 33, 0.85)',
                                border: `2px solid ${isArrived ? 'var(--success)' : 'rgba(255, 255, 255, 0.12)'}`,
                                color: isArrived ? '#ffffff' : 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 700,
                                zIndex: 2,
                                cursor: isActionable ? 'pointer' : 'not-allowed',
                                opacity: isActionable ? 1 : 0.4,
                                boxShadow: isArrived ? '0 0 10px rgba(16, 185, 129, 0.35)' : 'none',
                                transition: 'all 0.2s',
                                flexShrink: 0
                              }}
                            >
                              {isArrived ? '✓' : cp.order || (index + 1)}
                            </div>

                            {/* Checkpoint details */}
                            <div className="checkpoint-detail" style={{ flex: 1, textAlign: isRtl ? 'right' : 'left', minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                <h5 style={{ 
                                  fontSize: '13.5px', 
                                  fontWeight: 700, 
                                  color: isArrived ? 'var(--primary)' : 'var(--text-primary)',
                                  margin: 0,
                                  textDecoration: isArrived ? 'line-through' : 'none',
                                  transition: 'all 0.2s'
                                }}>
                                  {language === 'ar' ? (cp.nameAr || cp.name) : cp.name}
                                </h5>

                                {/* Arrived status badge button */}
                                <button
                                  onClick={() => toggleCheckpointArrived(cp.name)}
                                  disabled={!isActionable}
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    background: isArrived ? 'rgba(245, 183, 49, 0.15)' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${isArrived ? 'var(--primary)' : 'var(--border)'}`,
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    color: isArrived ? 'var(--primary)' : 'var(--text-muted)',
                                    cursor: isActionable ? 'pointer' : 'not-allowed',
                                    opacity: isActionable ? 1 : 0.4,
                                    transition: 'all 0.2s',
                                    flexShrink: 0
                                  }}
                                >
                                  {isArrived ? (isRtl ? 'وصلت ✓' : 'Arrived ✓') : (isRtl ? 'تأكيد الوصول' : 'Mark Arrived')}
                                </button>
                              </div>

                              {/* Distance warning/status indicator */}
                              {!isArrived && (
                                <div style={{ fontSize: '11px', marginTop: '4px', fontWeight: 500 }}>
                                  {!isPrevArrived ? (
                                    <span style={{ color: 'var(--text-muted)' }}>⚠️ {t('arrivePreviousFirst')}</span>
                                  ) : !hasPassengers ? (
                                    <span style={{ color: 'var(--success)' }}>✅ {t('readyToSkipNoPassengers')}</span>
                                  ) : distance === null ? (
                                    <span style={{ color: '#f59e0b' }}>⏳ {t('gpsRequired')}</span>
                                  ) : !isWithinRange ? (
                                    <span style={{ color: '#f59e0b' }}>📍 {t('tooFarFromCheckpoint', { distance: Math.round(distance) })}</span>
                                  ) : (
                                    <span style={{ color: 'var(--success)' }}>✅ {isRtl ? 'جاهز لتأكيد الوصول' : 'Ready to mark arrived'} ({t('currentDistance', { distance: Math.round(distance) })})</span>
                                  )}
                                </div>
                              )}
                              {isArrived && (
                                <div style={{ fontSize: '11px', marginTop: '4px', fontWeight: 500, color: 'var(--success)' }}>
                                  ✓ {isRtl ? 'تم الوصول للمحطة' : 'Arrived at stop'}
                                </div>
                              )}

                              {/* Stop Passengers Section */}
                              {(pickups.length > 0 || dropoffs.length > 0) && (
                                <div style={{ marginTop: '10px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px' }}>
                                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                                    👥 {t('passengersAtStop')}
                                  </div>

                                  {/* Drop-offs */}
                                  {dropoffs.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: pickups.length > 0 ? '10px' : '0' }}>
                                      <div style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: 700 }}>🛑 {isRtl ? 'تنزيل الركاب:' : 'Drop-offs:'}</div>
                                      {dropoffs.map((b) => {
                                        const isOffboarded = !!offboardedPassengers[b._id];
                                        return (
                                          <div key={b._id} className="glass-card" style={{ padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239, 68, 68, 0.02)', margin: 0 }}>
                                            <span style={{ fontSize: '11.5px', color: 'var(--text-primary)' }}>
                                              {b.userId?.name || 'Passenger'} (Seat #{b.seatNumbers?.join(', ') || 'N/A'})
                                            </span>
                                            <div>
                                              {!isArrived ? (
                                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('arriveStopFirst')}</span>
                                              ) : isOffboarded ? (
                                                <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 700 }}>{t('offboarded')}</span>
                                              ) : (
                                                <button
                                                  onClick={() => toggleOffboard(b._id)}
                                                  className="btn btn-secondary"
                                                  style={{ padding: '4px 8px', fontSize: '10px', height: '24px', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)' }}
                                                >
                                                  {t('offboardBtn')}
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Pick-ups */}
                                  {pickups.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      <div style={{ fontSize: '10px', color: 'var(--success)', fontWeight: 700 }}>🟢 {isRtl ? 'ركوب الركاب:' : 'Pick-ups:'}</div>
                                      {pickups.map((b) => {
                                        const isBoarded = b.status === 'BOARDED';
                                        const phone = b.userId?.phone;
                                        return (
                                          <div key={b._id} className="glass-card" style={{ padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.02)', margin: 0 }}>
                                            <span style={{ fontSize: '11.5px', color: 'var(--text-primary)' }}>
                                              {b.userId?.name || 'Passenger'} (Seat #{b.seatNumbers?.join(', ') || 'N/A'})
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              {phone && !isBoarded && isArrived && (
                                                <a href={`tel:${phone}`} className="btn-call" style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                  <Phone size={11} fill="currentColor" />
                                                </a>
                                              )}
                                              {!isArrived ? (
                                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('arriveStopFirst')}</span>
                                              ) : isBoarded ? (
                                                <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 700 }}>{t('onBoard')}</span>
                                              ) : (
                                                <button
                                                  onClick={() => handleCheckInPassenger(b._id)}
                                                  className="btn btn-primary"
                                                  style={{ padding: '4px 8px', fontSize: '10px', height: '24px' }}
                                                  disabled={actionLoading}
                                                >
                                                  {t('checkInBtn')}
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* SECTION 8: End Trip Button (In Transit Status) */}
                  <div style={{ marginBottom: '24px' }}>
                    <button
                      className="btn btn-primary btn-block"
                      style={{ 
                        background: canCompleteTrip ? 'var(--success)' : 'rgba(255,255,255,0.05)', 
                        color: canCompleteTrip ? 'var(--text-on-primary)' : 'var(--text-muted)', 
                        border: canCompleteTrip ? 'none' : '1px solid rgba(255,255,255,0.1)',
                        height: '52px', 
                        fontSize: '15px',
                        cursor: canCompleteTrip ? 'pointer' : 'not-allowed'
                      }}
                      onClick={() => {
                        if (canCompleteTrip) {
                          setConfirmStatusModal('COMPLETED');
                        }
                      }}
                      disabled={actionLoading || !canCompleteTrip}
                    >
                      <CheckCircle size={18} fill="currentColor" />
                      {t('completeTripShift')}
                    </button>

                    {/* Strict validations warnings */}
                    {!canCompleteTrip && (
                      <div style={{
                        marginTop: '8px',
                        fontSize: '0.78rem',
                        color: '#ef4444',
                        background: 'rgba(239, 68, 68, 0.08)',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        {!allCheckpointsArrived && <span>⚠️ {t('checkpointsRequired')}</span>}
                        {!allBoardedOffboarded && <span>⚠️ {t('dropOffRequired')}</span>}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}

            {/* SECTION 9: Trip Complete Summary (Completed Status) */}
            {activeTrip.status === 'COMPLETED' && (
              <div className="glass-card" style={{ 
                border: '1px solid rgba(16, 185, 129, 0.2)', 
                background: 'rgba(16, 185, 129, 0.05)', 
                textAlign: 'center', 
                padding: '24px',
                marginBottom: '24px'
              }}>
                <ShieldCheck size={40} style={{ color: 'var(--success)', marginBottom: '10px' }} />
                <h4 className="title-outfit" style={{ color: 'var(--success)', fontSize: '18px', margin: '0 0 6px 0' }}>
                  {t('shiftCompletedSuccess')}
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                  Shuttle shift has been saved. Safe driving, Captain!
                </p>
                <button
                  onClick={() => handleSelectTrip(null)}
                  className="btn btn-secondary"
                  style={{ marginTop: '14px', fontSize: '12px', padding: '8px 16px' }}
                >
                  Back to Day Shifts
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="glass-card" style={{ textAlign: 'center', padding: '40px 20px', marginTop: '10px' }}>
            <HelpCircle size={28} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
              {t('selectTripPrompt')}
            </p>
          </div>
        )}


      </div>

      {/* SOS Confirmation Modal */}
      {showSosConfirm && (
        <div 
          className="fade-in"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(6, 6, 14, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '24px'
          }}
        >
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '360px',
            textAlign: 'center',
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 8px 32px rgba(239, 68, 68, 0.25)',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '2px dashed #EF4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#EF4444',
              margin: '0 auto',
              fontSize: '24px'
            }}>
              🚨
            </div>
            <h4 className="title-outfit" style={{ fontSize: '18px', color: 'var(--text-primary)', margin: 0 }}>
              {t('confirmSosTitle')}
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              {t('confirmSosDesc')}
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button 
                onClick={() => setShowSosConfirm(false)} 
                className="btn btn-secondary" 
                style={{ flex: 1, padding: '12px' }}
              >
                {t('cancel')}
              </button>
              <button 
                onClick={() => {
                  setShowSosConfirm(false);
                  handleTriggerEmergencyPanic();
                }} 
                className="btn btn-danger" 
                style={{
                  flex: 1,
                  padding: '12px'
                }}
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Transition Modal */}
      {confirmStatusModal && (
        <div 
          className="fade-in"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(6, 6, 14, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '24px'
          }}
        >
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '360px',
            textAlign: 'center',
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: 'var(--shadow-md)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <h4 className="title-outfit" style={{ fontSize: '18px', color: 'var(--text-primary)', margin: 0 }}>
              {t(`confirm${confirmStatusModal === 'BOARDING' ? 'OpenBoarding' : (confirmStatusModal === 'IN_TRANSIT' ? 'StartDriving' : 'CompleteTrip')}`)}
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              {confirmStatusModal === 'BOARDING' && "This will notify passengers that boarding has commenced and open the QR scanner ticket check-in gates."}
              {confirmStatusModal === 'IN_TRANSIT' && "This will notify passengers that the shuttle is in transit. Live GPS coordinates will begin streaming."}
              {confirmStatusModal === 'COMPLETED' && "This will permanently close the trip, complete the passenger shifts, and stop telemetry. This cannot be undone."}
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button 
                onClick={() => setConfirmStatusModal(null)} 
                className="btn btn-secondary" 
                style={{ flex: 1, padding: '12px' }}
              >
                {t('cancel')}
              </button>
              <button 
                onClick={() => {
                  const targetStatus = confirmStatusModal;
                  setConfirmStatusModal(null);
                  handleUpdateTripStatus(targetStatus);
                }} 
                className="btn btn-primary" 
                style={{
                  flex: 1,
                  padding: '12px',
                  background: confirmStatusModal === 'COMPLETED' ? 'var(--danger)' : 'var(--primary)',
                  color: confirmStatusModal === 'COMPLETED' ? 'white' : 'var(--text-on-primary)'
                }}
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Drawer */}
      {notificationDrawerOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6, 6, 14, 0.75)',
          backdropFilter: 'blur(10px)',
          zIndex: 1500,
          display: 'flex',
          justifyContent: 'flex-end',
          animation: 'fade-in 0.2s ease'
        }} onClick={() => setNotificationDrawerOpen(false)}>
          <div style={{
            width: '100%',
            maxWidth: '360px',
            background: 'var(--surface)',
            borderLeft: '1px solid var(--border)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-md)',
            animation: 'slide-left 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }} onClick={e => e.stopPropagation()}>
            {/* Drawer Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="title-outfit" style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <Bell size={18} style={{ color: 'var(--primary)' }} /> {t('notificationsDrawerTitle')}
              </h3>
              <button onClick={() => setNotificationDrawerOpen(false)} style={{ color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            {/* Actions Bar */}
            {notifications.length > 0 && (
              <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'center', fontSize: '12px' }}>
                <button onClick={markAllRead} style={{ color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={12} /> {t('markAllRead')}
                </button>
              </div>
            )}
            {/* Notification List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
              {notifications.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--text-secondary)', padding: '24px', textAlign: 'center' }}>
                  <Bell size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                  <span style={{ fontSize: '13px' }}>{t('noNotifications')}</span>
                </div>
              ) : (
                notifications.map(n => (
                  <div 
                    key={n.id} 
                    onClick={() => markRead(n.id)}
                    className={`notification-item${n.read ? ' read' : ''}`}
                    style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      background: n.read ? 'transparent' : 'rgba(245, 183, 49, 0.03)',
                      borderLeft: n.read ? '3px solid transparent' : '3px solid var(--primary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: n.read ? 600 : 700, color: 'var(--text-primary)' }}>{n.title}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{n.time}</span>
                    </div>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{n.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* Slide animations style tag */}
      <style>{`
        @keyframes slide-left {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
