import { useEffect, useState, useRef } from 'react';
import { driverAPI } from '../services/api';
import { socketService } from '../services/socket';
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
  LifeBuoy,
  Download,
  Bell,
  Trash2,
  Check
} from 'lucide-react';
import logo from '../assets/d-ride-logo.jpeg';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import { Html5Qrcode } from 'html5-qrcode';
import maplibregl from 'maplibre-gl';
import { Capacitor } from '@capacitor/core';
import 'maplibre-gl/dist/maplibre-gl.css';

// Sound feedback helper
function playChime(isSuccess: boolean) {
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

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { t, language, setLanguage, isRtl } = useTranslation();
  const { notifications, markRead, markAllRead, clearNotifications, addNotification } = useNotifications();

  // Trips and calendar state
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTrip, setActiveTrip] = useState<any>(null);
  
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

  // Notifications & Permissions layout states
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);

  // Checkpoint arrival state
  const [arrivedCheckpoints, setArrivedCheckpoints] = useState<string[]>([]);

  // Load arrived checkpoints for active trip
  useEffect(() => {
    if (activeTrip?._id) {
      const stored = localStorage.getItem(`dride_arrived_checkpoints_${activeTrip._id}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setArrivedCheckpoints(parsed);
          // Wait briefly for socket connect and broadcast
          setTimeout(() => {
            socketService.sendCheckpointUpdate({
              vehicleId: activeTrip.vehicleId?._id || activeTrip.vehicleId?.id || 'mock-vehicle-123',
              arrivedCheckpoints: parsed,
            });
          }, 1000);
        } catch {
          setArrivedCheckpoints([]);
        }
      } else {
        setArrivedCheckpoints([]);
      }
    } else {
      setArrivedCheckpoints([]);
    }
  }, [activeTrip?._id]);

  const toggleCheckpointArrived = (checkpointName: string) => {
    if (!activeTrip) return;
    const isArrived = arrivedCheckpoints.includes(checkpointName);
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
  const [isStreaming, setIsStreaming] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isMocking, setIsMocking] = useState(false);
  const [lockCenter, setLockCenter] = useState(true);
  
  const geoWatchId = useRef<number | null>(null);
  const mockIntervalId = useRef<any>(null);

  // Generate 7 days for the calendar strip (today +/- 3 days)
  const [calendarDates, setCalendarDates] = useState<Date[]>([]);

  // Trigger notification when active trip changes
  useEffect(() => {
    if (activeTrip) {
      addNotification(
        `Active Shift Selected 🧭`,
        `Route "${activeTrip.routeId?.name || 'Assigned Route'}" is set as active. Check passenger manifest.`
      );
    }
  }, [activeTrip?._id]);
  
  useEffect(() => {
    const dates: Date[] = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    setCalendarDates(dates);
  }, []);

  // Fetch all driver trips
  const fetchTrips = async (autoSelect = false, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await driverAPI.getMyTrips();
      setTrips(data);
      
      // Auto-update active trip if it was already selected
      if (activeTrip) {
        const updated = data.find((x: any) => x._id === activeTrip._id);
        if (updated) {
          setActiveTrip(updated);
        }
      } else if (autoSelect && data.length > 0) {
        // Optionally auto-select the first matching trip today
        const todayStr = new Date().toDateString();
        const todayTrip = data.find((x: any) => new Date(x.departureTime).toDateString() === todayStr && x.status !== 'COMPLETED' && x.status !== 'CANCELLED');
        if (todayTrip) {
          handleSelectTrip(todayTrip);
        }
      }
    } catch (error) {
      console.error('Failed to load driver trips', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Fetch manifest for the selected active trip
  const fetchTripManifest = async (tripId: string) => {
    try {
      setManifestLoading(true);
      const manifestData = await driverAPI.getTripManifest(tripId);
      setManifest(manifestData);
    } catch (error) {
      console.error('Failed to load trip manifest', error);
    } finally {
      setManifestLoading(false);
    }
  };

  // Connect socket on mount, disconnect on unmount
  useEffect(() => {
    socketService.connect();
    fetchTrips(true);
    return () => {
      stopLocationStream();
      socketService.disconnect();
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

  // When active trip changes, load its manifest and reset states
  const handleSelectTrip = (trip: any) => {
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
  };

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

            const parsed = JSON.parse(decodedText);
            if (!parsed.bookingId || !parsed.token) {
              setScanStatus({ type: 'error', message: t('invalidQrStructure') });
              playChime(false);
              return;
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

  // Helpers to draw on map
  const drawRoutePolyline = () => {
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
        'line-color': '#174ea6',
        'line-width': 8,
        'line-opacity': 0.9,
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
        'line-color': '#8ab4f8',
        'line-width': 5,
        'line-opacity': 0.95,
      },
    });
  };

  const drawCheckpointMarkers = () => {
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
  };

  // Update bus marker position on coords change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentCoords) return;

    if (!busMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'google-maps-bus-pointer';

      busMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([currentCoords.lng, currentCoords.lat])
        .addTo(map);
    } else {
      busMarkerRef.current.setLngLat([currentCoords.lng, currentCoords.lat]);
    }

    if (lockCenter) {
      map.flyTo({ center: [currentCoords.lng, currentCoords.lat], duration: 500 });
    }
  }, [currentCoords, lockCenter]);

  // Location Telemetry Broadcasting
  const startLocationStream = () => {
    if (isStreaming) return;
    const gpsPermitted = localStorage.getItem('dride_gps_permitted') === 'true';
    if (gpsPermitted) {
      triggerRealGPS();
    } else {
      setPermissionModalVisible(true);
    }
  };

  const triggerRealGPS = () => {
    setIsStreaming(true);
    setGpsError(null);
    localStorage.setItem('dride_gps_permitted', 'true');
    setPermissionModalVisible(false);

    let startLat = 30.0444;
    let startLng = 31.2357;
    
    if (activeTrip?.routeId?.path?.coordinates?.length > 0) {
      const firstCoord = activeTrip.routeId.path.coordinates[0];
      startLng = firstCoord[0];
      startLat = firstCoord[1];
    }
    
    setCurrentCoords({ lat: startLat, lng: startLng });

    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCurrentCoords({ lat, lng });
          
          socketService.sendLocation({
            vehicleId: activeTrip?.vehicleId?._id || 'mock-vehicle-123',
            driverId: user?._id || 'mock-driver-123',
            longitude: lng,
            latitude: lat,
          });
        },
        (error) => {
          console.warn('GPS failed, fallback to simulator:', error.message);
          setGpsError(t('gpsNotAvailable'));
          setIsMocking(true);
          startMockSimulation(startLat, startLng);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
      geoWatchId.current = watchId;
    } else {
      setGpsError(t('geoNotSupported'));
      setIsMocking(true);
      startMockSimulation(startLat, startLng);
    }
  };

  const stopLocationStream = () => {
    if (geoWatchId.current !== null) {
      navigator.geolocation.clearWatch(geoWatchId.current);
      geoWatchId.current = null;
    }
    if (mockIntervalId.current !== null) {
      clearInterval(mockIntervalId.current);
      mockIntervalId.current = null;
    }
    setIsStreaming(false);
    setIsMocking(false);
  };

  const startMockSimulation = (initLat: number, initLng: number) => {
    let lat = initLat;
    let lng = initLng;
    let step = 0;

    const mockRoutePath = streetPath.length > 0
      ? streetPath.map(c => [c[1], c[0]])
      : (activeTrip?.routeId?.path?.coordinates || [[31.2357, 30.0444]]);

    mockIntervalId.current = setInterval(() => {
      const nextCoord = mockRoutePath[step % mockRoutePath.length];
      lng = nextCoord[0];
      lat = nextCoord[1];
      step++;

      setCurrentCoords({ lat, lng });

      socketService.sendLocation({
        vehicleId: activeTrip?.vehicleId?._id || 'mock-vehicle-123',
        driverId: user?._id || 'mock-driver-123',
        longitude: lng,
        latitude: lat,
      });
    }, 3000);
  };

  // Status transitions
  const handleUpdateTripStatus = async (newStatus: string) => {
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
  };

  const handleCheckInPassenger = async (bookingId: string) => {
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
  };

  const toggleOffboard = (bookingId: string) => {
    setOffboardedPassengers(prev => ({
      ...prev,
      [bookingId]: !prev[bookingId]
    }));
  };

  // Filter trips for selected day in calendar
  const filteredTrips = trips.filter((t) => {
    const tripDate = new Date(t.departureTime);
    return tripDate.toDateString() === selectedDate.toDateString();
  });

  return (
    <div className="app-container">
      {/* Top Header */}
      <div className="floating-header" style={{
        background: 'rgba(14, 14, 27, 0.45)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '100px',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: '1rem',
        zIndex: 10,
        margin: '1rem 1rem 0 1rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={logo} alt="Logo" style={{ height: '32px', width: 'auto', borderRadius: '4px', objectFit: 'contain', boxShadow: '0 0 10px rgba(245, 183, 49, 0.3)', flexShrink: 0 }} />
          <div>
            <h2 className="title-outfit" style={{ fontSize: '14px', margin: 0, color: 'var(--text-primary)' }}>
              {t('helloDriver', { name: user?.name || 'Driver' })}
            </h2>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              {t('cairoRegionFleet')}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button
            onClick={() => setNotificationDrawerOpen(true)}
            style={{ position: 'relative', color: 'var(--text-secondary)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', padding: 0 }}
            title="Notifications"
          >
            <Bell size={18} />
            {notifications.filter(n => !n.read).length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                background: 'var(--primary)',
                color: 'black',
                borderRadius: '50%',
                width: '14px',
                height: '14px',
                fontSize: '9px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {notifications.filter(n => !n.read).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', padding: 0 }}
            title={language === 'en' ? 'العربية' : 'English'}
          >
            <Globe size={18} />
          </button>
          <button
            onClick={logout}
            style={{ color: 'var(--danger)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', padding: 0 }}
            title={t('signOut')}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

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

        {/* SECTION 1: Calendar Strip */}
        <div style={{ marginBottom: '12px' }}>
          <div className="calendar-strip">
            {calendarDates.map((date, index) => {
              const isActive = date.toDateString() === selectedDate.toDateString();
              const isToday = date.toDateString() === new Date().toDateString();
              
              // Get day name (e.g. MON) and day number (e.g. 15)
              const dayName = date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short' });
              const dayNum = date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric' });

              return (
                <button
                  key={index}
                  onClick={() => {
                    setSelectedDate(date);
                    // Clear selected trip when date changes to prevent confusion
                    handleSelectTrip(null);
                  }}
                  className={`calendar-day-btn ${isActive ? 'active' : ''}`}
                  style={{
                    border: isToday && !isActive ? '1px solid var(--primary)' : undefined,
                    boxShadow: isToday && !isActive ? 'inset 0 0 6px rgba(245, 183, 49, 0.15)' : undefined
                  }}
                >
                  <span className="cal-day">{dayName}</span>
                  <span className="cal-num">{dayNum}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: Trip Cards for Selected Date */}
        <div style={{ marginBottom: '24px' }}>
          <h4 className="section-title">
            <CalendarIcon size={16} style={{ color: 'var(--primary)' }} />
            {selectedDate.toLocaleDateString(language === 'ar' ? 'ar-EG' : undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric'
            })}
          </h4>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '30px 0' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t('loadingAssignments')}</span>
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '30px 20px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                {t('noTripsFound')}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredTrips.map((trip) => {
                const isSelected = activeTrip?._id === trip._id;
                const routeName = trip.routeId?.name || t('assignedRoute');
                const timeStr = new Date(trip.departureTime).toLocaleTimeString(language === 'ar' ? 'ar-EG' : undefined, {
                  hour: '2-digit',
                  minute: '2-digit'
                });

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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <span className={`status-tag ${trip.status.toLowerCase().replace('_', '-')}`}>
                        {trip.status}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <Clock size={13} />
                        <span>{timeStr}</span>
                      </div>
                    </div>

                    <h4 className="title-outfit" style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={16} style={{ color: 'var(--primary)' }} />
                      {routeName}
                    </h4>

                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                      paddingTop: '10px',
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
              })}
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
              const canStart = diffMinutes <= 30;

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
                          ? `يمكنك بدء الرحلة قبل موعدها بـ 30 دقيقة كحد أقصى (المتبقي: ${diffMinutes} دقيقة)` 
                          : `You can only start the trip at most 30 minutes before departure (Scheduled in ${diffMinutes} mins)`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* SECTION 4: Boarding Gate - QR Scanner & Passenger Manifest (Scheduled/Boarding Status) */}
            {(activeTrip.status === 'SCHEDULED' || activeTrip.status === 'BOARDING') && (
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
                    {t('passengerList', { count: manifest.length })}
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
                    {manifest.map((booking) => {
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
            )}

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

                <div className="embedded-map-container" ref={mapContainerRef} />

                {/* GPS Alert Warning Banner */}
                {gpsError && (
                  <div style={{
                    marginTop: '10px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: 'var(--warning)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '11px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <AlertTriangle size={15} />
                    <span>{gpsError}</span>
                  </div>
                )}

                {/* Live stream status card */}
                <div style={{
                  marginTop: '10px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: isStreaming ? 'var(--success)' : 'var(--text-muted)',
                      boxShadow: isStreaming ? '0 0 8px var(--success)' : 'none',
                    }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {isStreaming ? (isMocking ? t('simulatedTelemetry') : t('liveGpsBroadcast')) : t('gpsStandby')}
                    </span>
                  </div>

                  {currentCoords && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        onClick={() => setLockCenter(!lockCenter)}
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          color: lockCenter ? 'var(--primary)' : 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                      >
                        {lockCenter ? '🔒 Lock' : '🔓 Free'}
                      </button>
                      
                      {isStreaming ? (
                        <button
                          onClick={stopLocationStream}
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            color: 'var(--danger)',
                            cursor: 'pointer'
                          }}
                        >
                          Pause GPS
                        </button>
                      ) : (
                        <button
                          onClick={startLocationStream}
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            background: 'rgba(245, 183, 49, 0.1)',
                            border: '1px solid rgba(245, 183, 49, 0.2)',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            color: 'var(--primary)',
                            cursor: 'pointer'
                          }}
                        >
                          Resume GPS
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 6b: Route Checkpoints Timeline Checklist (In Transit Status) */}
            {activeTrip.status === 'IN_TRANSIT' && activeTrip.routeId?.checkpoints && (
              <div style={{ marginBottom: '24px' }}>
                <h4 className="section-title">
                  <MapPin size={16} style={{ color: 'var(--primary)' }} />
                  Route Checkpoints Timeline
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 16px' }}>
                  {activeTrip.routeId.checkpoints
                    .slice()
                    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                    .map((cp: any, index: number) => {
                      const isArrived = arrivedCheckpoints.includes(cp.name);
                      
                      // Passengers to drop off at this stop
                      const dropoffs = manifest.filter(b => 
                        (b.dropoffStopId === cp.name || b.dropoffCheckpoint?.name === cp.name) && 
                        (b.status === 'CONFIRMED' || b.status === 'BOARDED')
                      );

                      // Passengers to pick up at this stop
                      const pickups = manifest.filter(b => 
                        (b.pickupStopId === cp.name || b.pickupCheckpoint?.name === cp.name) && 
                        b.status === 'CONFIRMED'
                      );

                      return (
                        <div key={cp.name || index} style={{ 
                          display: 'flex', 
                          gap: '14px', 
                          position: 'relative',
                          paddingBottom: index === activeTrip.routeId.checkpoints.length - 1 ? 0 : '16px'
                        }}>
                          {/* Timeline vertical line */}
                          {index !== activeTrip.routeId.checkpoints.length - 1 && (
                            <div style={{
                              position: 'absolute',
                              left: '12px',
                              top: '28px',
                              bottom: 0,
                              width: '2px',
                              background: isArrived ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
                              zIndex: 1
                            }} />
                          )}

                          {/* Checkpoint order marker */}
                          <div 
                            onClick={() => toggleCheckpointArrived(cp.name)}
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              background: isArrived ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                              border: `1.5px solid ${isArrived ? 'var(--primary)' : 'rgba(255, 255, 255, 0.2)'}`,
                              color: isArrived ? 'black' : 'var(--text-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 700,
                              zIndex: 2,
                              cursor: 'pointer',
                              boxShadow: isArrived ? '0 0 10px rgba(245, 183, 49, 0.4)' : 'none',
                              transition: 'all 0.2s',
                              flexShrink: 0
                            }}
                          >
                            {isArrived ? '✓' : cp.order || (index + 1)}
                          </div>

                          {/* Checkpoint details */}
                          <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
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
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  background: isArrived ? 'rgba(245, 183, 49, 0.15)' : 'rgba(255,255,255,0.03)',
                                  border: `1px solid ${isArrived ? 'var(--primary)' : 'var(--border)'}`,
                                  borderRadius: '4px',
                                  padding: '3px 8px',
                                  color: isArrived ? 'var(--primary)' : 'var(--text-muted)',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  flexShrink: 0
                                }}
                              >
                                {isArrived ? 'Arrived ✓' : 'Mark Arrived'}
                              </button>
                            </div>

                            {/* Drop-offs and Pick-ups detailed list */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                              {/* Drop-offs */}
                              {dropoffs.length > 0 ? (
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>🛑 Drop-offs: </span>
                                  {dropoffs.map((b, bIdx) => (
                                    <span key={b._id} style={{ color: 'var(--text-primary)' }}>
                                      {b.userId?.name || 'Passenger'} (Seat #{b.seatNumbers?.join(', ') || 'N/A'}){bIdx === dropoffs.length - 1 ? '' : ', '}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  <span style={{ fontWeight: 600 }}>🛑 Drop-offs: </span>None
                                </div>
                              )}

                              {/* Pick-ups */}
                              {pickups.length > 0 ? (
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>🟢 Pick-ups: </span>
                                  {pickups.map((b, bIdx) => (
                                    <span key={b._id} style={{ color: 'var(--text-primary)' }}>
                                      {b.userId?.name || 'Passenger'} (Seat #{b.seatNumbers?.join(', ') || 'N/A'}){bIdx === pickups.length - 1 ? '' : ', '}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  <span style={{ fontWeight: 600 }}>🟢 Pick-ups: </span>None
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* SECTION 7: Offboard Passengers (In Transit Status) */}
            {activeTrip.status === 'IN_TRANSIT' && (
              <div style={{ marginBottom: '24px' }}>
                <h4 className="section-title">
                  <Users size={16} style={{ color: 'var(--primary)' }} />
                  Passenger Drop-Off Manifest ({manifest.length})
                </h4>

                {manifest.length === 0 ? (
                  <div className="glass-card" style={{ textAlign: 'center', padding: '20px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{t('noPassengersBooked')}</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {manifest.map((booking) => {
                      const passenger = booking.userId || {};
                      const name = passenger.name || 'Passenger';
                      const isOffboarded = offboardedPassengers[booking._id];
                      const phone = passenger.phone || '';

                      return (
                        <div key={booking._id} className="glass-card" style={{ padding: '12px 16px', opacity: isOffboarded ? 0.65 : 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <h5 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                                {name}
                              </h5>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                Seat {booking.seatNumbers?.join(', ') || 'N/A'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {phone && !isOffboarded && (
                                <a 
                                  href={`tel:${phone}`}
                                  className="btn-call"
                                  title={t('callPassenger')}
                                  style={{ width: '32px', height: '32px' }}
                                >
                                  <Phone size={13} fill="currentColor" />
                                </a>
                              )}

                              <button
                                onClick={() => toggleOffboard(booking._id)}
                                className={`btn ${isOffboarded ? 'btn-secondary' : 'btn-primary'}`}
                                style={{
                                  padding: '5px 12px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  height: '30px',
                                  background: isOffboarded ? 'rgba(255,255,255,0.03)' : 'rgba(239, 68, 68, 0.1)',
                                  borderColor: isOffboarded ? 'transparent' : 'rgba(239, 68, 68, 0.2)',
                                  color: isOffboarded ? 'var(--text-secondary)' : 'var(--danger)'
                                }}
                              >
                                {isOffboarded ? t('offboarded') : t('offboardBtn')}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* SECTION 8: End Trip Button (In Transit Status) */}
            {activeTrip.status === 'IN_TRANSIT' && (
              <div style={{ marginBottom: '24px' }}>
                <button
                  className="btn btn-primary btn-block"
                  style={{ background: 'var(--success)', color: 'var(--text-on-primary)', height: '52px', fontSize: '15px' }}
                  onClick={() => setConfirmStatusModal('COMPLETED')}
                  disabled={actionLoading}
                >
                  <CheckCircle size={18} fill="currentColor" />
                  {t('completeTripShift')}
                </button>
              </div>
            )}

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

        {/* SECTION 10: Contact Support (Always Visible at Bottom) */}
        <div id="help-section" style={{ marginTop: '30px' }}>
          <h4 className="section-title">
            <LifeBuoy size={16} style={{ color: 'var(--danger)' }} />
            {t('help')} & Support Command
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Emergency Hotline */}
            <a href="tel:19999" className="help-contact-card">
              <div>
                <h5 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 2px 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  🚨 {t('emergencyContact')}
                </h5>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                  {t('emergencyDesc')}
                </p>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--danger)' }}>19999</span>
            </a>

            {/* Standard Fleet Support */}
            <a href="tel:+201012345678" className="help-contact-card secondary-help">
              <div>
                <h5 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 2px 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  📞 {t('supportContact')}
                </h5>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                  {t('supportDesc')}
                </p>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>+201012345678</span>
            </a>
          </div>
        </div>
      </div>

      {/* Confirmation Transition Modal */}
      {confirmStatusModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6, 6, 14, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '24px',
          animation: 'fade-in 0.25s ease'
        }}>
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
                <Bell size={18} style={{ color: 'var(--primary)' }} /> Notifications
              </h3>
              <button onClick={() => setNotificationDrawerOpen(false)} style={{ color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            {/* Actions Bar */}
            {notifications.length > 0 && (
              <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <button onClick={markAllRead} style={{ color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={12} /> Mark all read
                </button>
                <button onClick={clearNotifications} style={{ color: 'var(--danger)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Trash2 size={12} /> Clear all
                </button>
              </div>
            )}
            {/* Notification List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
              {notifications.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--text-secondary)', padding: '24px', textAlign: 'center' }}>
                  <Bell size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                  <span style={{ fontSize: '13px' }}>All caught up! No notifications.</span>
                </div>
              ) : (
                notifications.map(n => (
                  <div 
                    key={n.id} 
                    onClick={() => markRead(n.id)}
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

      {/* GPS Permission Opt-In Modal */}
      {permissionModalVisible && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6, 6, 14, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2500,
          padding: '24px',
          animation: 'fade-in 0.25s ease'
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '380px',
            textAlign: 'center',
            padding: '32px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxShadow: 'var(--shadow-md)',
            border: '1px solid rgba(245, 183, 49, 0.2)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: 'rgba(245, 183, 49, 0.1)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              border: '1.5px solid var(--primary)',
              boxShadow: 'var(--shadow-glow)'
            }}>
              <Navigation size={28} style={{ color: 'var(--primary)' }} />
            </div>

            <div>
              <h3 className="title-outfit" style={{ fontSize: '18px', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
                Allow Live Route Telemetry
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                To broadcast your live coordinates to D-Ride transit dispatch, guide commuters to your pickup terminals, and ensure passenger safety, please grant device location permission.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={triggerRealGPS}
                className="btn btn-primary btn-block"
                style={{ height: '46px', fontSize: '13.5px' }}
              >
                Allow & Share Location
              </button>
              <button
                onClick={() => {
                  setPermissionModalVisible(false);
                  setIsStreaming(true);
                  setIsMocking(true);
                  let startLat = 30.0444;
                  let startLng = 31.2357;
                  if (activeTrip?.routeId?.path?.coordinates?.length > 0) {
                    const firstCoord = activeTrip.routeId.path.coordinates[0];
                    startLng = firstCoord[0];
                    startLat = firstCoord[1];
                  }
                  setGpsError("Permission bypassed. Simulator running.");
                  startMockSimulation(startLat, startLng);
                }}
                className="btn btn-secondary btn-block"
                style={{ height: '46px', fontSize: '13.5px' }}
              >
                Run Route Simulation (Local Test)
              </button>
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
