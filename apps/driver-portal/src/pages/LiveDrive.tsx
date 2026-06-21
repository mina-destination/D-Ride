import { useEffect, useState, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { useParams, useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { socketService } from '../services/socket';
import { driverAPI, API_URL } from '../services/api';
import { BackgroundLocation } from '../capacitor-plugins/background-location';
import { 
  ArrowLeft, 
  Play, 
  Square, 
  AlertTriangle, 
  Globe, 
  Sun, 
  Moon,
  MapPin,
  Users,
  CheckCircle,
  Navigation,
  ShieldCheck,
  Phone,
  Info,
  Lock,
  Unlock,
  Signal,
  Check,
  UserCheck,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

// Sound feedback helper
function playChime(isSuccess: boolean) {
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

// Distance helper (Haversine Formula)
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

export default function LiveDrivePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language, setLanguage, isRtl } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const busMarkerRef = useRef<maplibregl.Marker | null>(null);
  const checkpointMarkersRef = useRef<maplibregl.Marker[]>([]);

  const [trip, setTrip] = useState<any>(null);
  const tripRef = useRef<any>(null);
  useEffect(() => {
    tripRef.current = trip;
  }, [trip]);
  const [loading, setLoading] = useState(true);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [streetPath, setStreetPath] = useState<[number, number][]>([]);
  
  // HUD states
  const [manifest, setManifest] = useState<any[]>([]);
  const [arrivedCheckpoints, setArrivedCheckpoints] = useState<string[]>([]);
  const [speed, setSpeed] = useState<number>(0);
  const [heading, setHeading] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'telemetry' | 'stops' | 'passengers'>('telemetry');
  const [actionLoading, setActionLoading] = useState(false);
  
  // Streaming status
  const [isStreaming, setIsStreaming] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [lockCenter, setLockCenter] = useState(true);
  
  const geoWatchId = useRef<any>(null);

  // Load trip details, arrived checkpoints, and manifest
  useEffect(() => {
    const fetchTripDetails = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const trips = await driverAPI.getMyTrips();
        const currentTrip = trips.find((t: any) => t._id === id);
        setTrip(currentTrip);

        if (currentTrip) {
          // Load manifest
          try {
            const manifestData = await driverAPI.getTripManifest(id);
            setManifest(manifestData || []);
          } catch (e) {
            console.error('Failed to load trip manifest', e);
          }

          // Load arrived checkpoints
          const stored = localStorage.getItem(`dride_arrived_checkpoints_${id}`);
          if (stored) {
            setArrivedCheckpoints(JSON.parse(stored));
          } else {
            try {
              const serverCheckpoints = await driverAPI.getArrivedCheckpoints(id);
              setArrivedCheckpoints(serverCheckpoints || []);
              localStorage.setItem(`dride_arrived_checkpoints_${id}`, JSON.stringify(serverCheckpoints || []));
            } catch (err) {
              console.error('Failed to load arrived checkpoints', err);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load trip context', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTripDetails();
  }, [id]);

  // Load OSM Turn-by-Turn Street-level coordinates from OSRM
  useEffect(() => {
    if (!trip || !trip.routeId?.checkpoints) return;
    const checkpoints = trip.routeId.checkpoints;
    if (checkpoints.length < 2) return;

    const loadStreetRoute = async () => {
      const coordsString = checkpoints
        .map((cp: any) => {
          const coords = cp.location?.coordinates || cp.coordinates;
          return `${coords[0]},${coords[1]}`;
        })
        .join(';');
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          const coords = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
          setStreetPath(coords);
        } else {
          throw new Error('No routes returned');
        }
      } catch (err) {
        console.warn("Failed to fetch OSRM street route, falling back to static coords:", err);
        // Fallback to route path coordinates
        if (trip.routeId.path?.coordinates) {
          setStreetPath(trip.routeId.path.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]));
        }
      }
    };
    loadStreetRoute();
  }, [trip]);

  // Initialize MapLibre map
  useEffect(() => {
    if (!mapContainerRef.current || loading) return;
    if (mapRef.current) return; // already initialized

    const initCenter: [number, number] = currentCoords
      ? [currentCoords.lng, currentCoords.lat]
      : [31.2357, 30.0444]; // Cairo default

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: initCenter,
      zoom: 15,
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

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [loading]);

  // Draw route polyline on map when streetPath changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || streetPath.length === 0) return;

    const addRoute = () => {
      // Remove existing source/layer if present
      if (map.getSource('route-path')) {
        if (map.getLayer('route-path-layer')) map.removeLayer('route-path-layer');
        if (map.getLayer('route-path-layer-casing')) map.removeLayer('route-path-layer-casing');
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

      // Gold Casing Border
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

      // Gold Amber Center Line
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
    };

    if (map.getStyle() && map.isStyleLoaded()) {
      addRoute();
    } else {
      map.on('load', addRoute);
    }
  }, [streetPath]);

  // Add checkpoint markers on the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !trip?.routeId?.checkpoints) return;

    // Clear old checkpoint markers
    checkpointMarkersRef.current.forEach((m) => m.remove());
    checkpointMarkersRef.current = [];

    const addMarkers = () => {
      trip.routeId.checkpoints.forEach((cp: any, idx: number) => {
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
        const popup = new maplibregl.Popup({ offset: isStart || isEnd ? 15 : 12, closeButton: false }).setHTML(
          `<div style="color:#fff; font-size:12px; font-weight:bold; padding:2px 4px;">${cpName}</div>`
        );

        const marker = new maplibregl.Marker({ element: el, anchor: isStart || isEnd ? 'bottom' : 'center' })
          .setLngLat([coords[0], coords[1]])
          .setPopup(popup)
          .addTo(map);

        // Show popup permanently
        marker.togglePopup();

        checkpointMarkersRef.current.push(marker);
      });
    };

    addMarkers();
  }, [trip, language]);

  // Update bus marker position when currentCoords changes
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

  // Strictly update based on actual Geolocation inputs only

  const stopLocationStream = () => {
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
    setSpeed(0);
    setHeading(0);
  };

  // Connect socket on mount, disconnect on unmount
  useEffect(() => {
    socketService.connect();

    const handleTripStatusUpdate = (data: any) => {
      if (trip && (data.tripId === trip._id || data.tripId === trip.id)) {
        setTrip((prev: any) => prev ? { ...prev, status: data.status } : null);
        if (data.status === 'COMPLETED' || data.status === 'CANCELLED') {
          stopLocationStream();
          alert(`Trip status updated by admin to: ${data.status}`);
          navigate(`/trips/${id}`);
        }
      }
    };

    const handleCheckpointUpdate = (data: any) => {
      if (data.arrivedCheckpoints) {
        setArrivedCheckpoints(data.arrivedCheckpoints);
        localStorage.setItem(`dride_arrived_checkpoints_${id}`, JSON.stringify(data.arrivedCheckpoints));
      }
    };

    if (socketService.socket) {
      socketService.socket.on('tripStatusUpdate', handleTripStatusUpdate);
      socketService.socket.on('checkpointUpdate', handleCheckpointUpdate);
    }

    return () => {
      stopLocationStream();
      if (socketService.socket) {
        socketService.socket.off('tripStatusUpdate', handleTripStatusUpdate);
        socketService.socket.off('checkpointUpdate', handleCheckpointUpdate);
      }
      socketService.disconnect();
    };
  }, [trip, id]);

  const startLocationStream = async () => {
    if (isStreaming) return;

    try {
      const permStatus = await Geolocation.checkPermissions();
      if (permStatus.location === 'prompt' || permStatus.location === 'prompt-with-rationale') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted') {
          setGpsError(t('gpsNotAvailable'));
          return;
        }
      } else if (permStatus.location === 'denied') {
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

    if (Capacitor.isNativePlatform()) {
      const token = localStorage.getItem('dride_driver_token') || '';
      BackgroundLocation.start({
        apiUrl: API_URL,
        token,
        vehicleId: tripRef.current?.vehicleId?._id || '',
        driverId: user?._id || '',
      }).catch(err => console.warn('Failed to start background location:', err));
    }

    const watchOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    };

    const handleSuccess = (lat: number, lng: number, speedVal?: number | null, headingVal?: number | null) => {
      setCurrentCoords({ lat, lng });
      const computedSpeed = speedVal != null && speedVal > 0 ? speedVal * 3.6 : 0;
      setSpeed(Number(computedSpeed.toFixed(1)));
      if (headingVal != null) {
        setHeading(headingVal);
      }
      socketService.sendLocation({
        vehicleId: tripRef.current?.vehicleId?._id || 'mock-vehicle-123',
        driverId: user?._id || 'mock-driver-123',
        longitude: lng,
        latitude: lat,
        speed: computedSpeed,
        heading: headingVal ?? null,
      });
    };

    const handleFailure = (errorMsg: string) => {
      console.warn('GPS error:', errorMsg);
      setGpsError(t('gpsNotAvailable'));
      setIsStreaming(false);
      setSpeed(0);
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
                position.coords.speed,
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
              position.coords.speed,
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
        setSpeed(0);
      }
    }
  };

  // Automatically start live tracking when the driver opens the active shift view (LiveDrive mounts)
  useEffect(() => {
    startLocationStream();
    return () => {
      stopLocationStream();
    };
  }, []);

  const handleToggleCheckpoint = async (checkpointName: string) => {
    if (!trip) return;
    const sortedCPs = trip.routeId?.checkpoints || [];
    const cpIndex = sortedCPs.findIndex((c: any) => c.name === checkpointName);
    if (cpIndex === -1) return;

    const isArrived = arrivedCheckpoints.includes(checkpointName);
    
    if (!isArrived) {
      // 1. Sequence check
      if (cpIndex > 0) {
        const prevCp = sortedCPs[cpIndex - 1];
        if (!arrivedCheckpoints.includes(prevCp.name)) {
          alert(t('arrivePreviousFirst'));
          return;
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

      // 2. Distance check
      if (hasPassengers) {
        const targetCp = sortedCPs[cpIndex];
        const cpCoords = targetCp.location?.coordinates || targetCp.coordinates;
        if (cpCoords) {
          if (!currentCoords) {
            alert(t('gpsRequired'));
            return;
          }
          const dist = getDistanceInMeters(currentCoords.lat, currentCoords.lng, cpCoords[1], cpCoords[0]);
          if (dist > 200) {
            alert(t('tooFarFromCheckpoint', { distance: Math.round(dist) }));
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
    
    setActionLoading(true);
    try {
      setArrivedCheckpoints(updated);
      localStorage.setItem(`dride_arrived_checkpoints_${id}`, JSON.stringify(updated));

      // Emit socket update
      socketService.sendCheckpointUpdate({
        vehicleId: trip.vehicleId?._id || trip.vehicleId?.id || 'mock-vehicle-123',
        arrivedCheckpoints: updated,
      });
      playChime(true);
    } catch (e) {
      console.error(e);
      playChime(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckInPassenger = async (bookingId: string) => {
    try {
      setActionLoading(true);
      await driverAPI.checkInPassenger(bookingId);
      playChime(true);
      // Optimistically update manifest UI list
      setManifest((prev) =>
        prev.map((b) => (b._id === bookingId ? { ...b, isCheckedIn: true, status: 'BOARDED' } : b))
      );
      // Re-fetch manifest in background to confirm
      const manifestData = await driverAPI.getTripManifest(id!);
      setManifest(manifestData || []);
    } catch (error) {
      playChime(false);
      console.error(error);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 24px', background: 'var(--background)', color: 'var(--text-primary)', height: '100vh', alignItems: 'center' }}>
        <span>{t('initializingMap')}</span>
      </div>
    );
  }

  return (
    <div className="app-container fade-in-up" style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', paddingBottom: 0 }}>
      
      {/* Top Header Floating Card */}
      <div className="floating-header" style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        right: '16px',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <button
          onClick={() => {
            stopLocationStream();
            navigate(`/trips/${id}`);
          }}
          style={{
            background: 'rgba(14, 14, 27, 0.85)',
            backdropFilter: 'blur(20px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-md)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <ArrowLeft size={20} style={{ transform: isRtl ? 'rotate(180deg)' : 'none' }} />
        </button>

        <div style={{
          flex: 1,
          padding: '10px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          overflow: 'hidden',
          background: 'rgba(14, 14, 27, 0.85)',
          backdropFilter: 'blur(20px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          boxShadow: 'var(--shadow-md)'
        }}>
          <span style={{ fontSize: '10px', color: 'var(--primary)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.07em' }}>
            {t('activeRouteLabel')}
          </span>
          <h3 className="title-outfit" style={{ fontSize: '14px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
            {trip?.routeId?.name || t('drivingRoute')}
          </h3>
        </div>

        <button
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          style={{
            background: 'rgba(14, 14, 27, 0.85)',
            backdropFilter: 'blur(20px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-md)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          title={language === 'en' ? 'العربية' : 'English'}
        >
          <Globe size={20} />
        </button>
      </div>

      {/* MapLibre Map Element */}
      <div style={{ position: 'relative', flex: 1, height: '100%', width: '100%' }}>
        <div
          ref={mapContainerRef}
          style={{ height: '100%', width: '100%', zIndex: 0 }}
        />
        {currentCoords && (
          <button
            onClick={() => setLockCenter(!lockCenter)}
            style={{
              position: 'absolute',
              bottom: '410px',
              right: '16px',
              zIndex: 1000,
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'rgba(14, 14, 27, 0.85)',
              backdropFilter: 'blur(20px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: lockCenter ? 'var(--primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-md)',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              outline: 'none'
            }}
            title={lockCenter ? 'Unlock View' : 'Lock View'}
          >
            {lockCenter ? <Lock size={18} /> : <Unlock size={18} />}
          </button>
        )}
      </div>

      {/* GPS Alert Warning Banner */}
      {gpsError && (
        <div style={{
          position: 'absolute',
          bottom: '335px',
          left: '16px',
          right: '16px',
          zIndex: 1000,
          background: 'rgba(239, 68, 68, 0.95)',
          backdropFilter: 'blur(8px)',
          color: '#ffffff',
          padding: '10px 16px',
          borderRadius: 'var(--radius-md)',
          fontSize: '12px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: 'var(--shadow-md)',
          animation: 'fadeIn 0.3s ease'
        }}>
          <AlertTriangle size={18} />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Bottom Telemetry Control Dock */}
      <div style={{
        position: 'absolute',
        bottom: '24px',
        left: '16px',
        right: '16px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxHeight: '380px'
      }}>
        {/* Dock Tab Selector */}
        <div style={{
          display: 'flex',
          background: 'rgba(18, 22, 33, 0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '4px',
          gap: '4px'
        }}>
          <button
            onClick={() => setActiveTab('telemetry')}
            style={{
              flex: 1,
              padding: '8px 4px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'telemetry' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'telemetry' ? 'var(--text-on-primary)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <Navigation size={14} />
            <span>{language === 'ar' ? 'السرعة والموقع' : 'Telemetry'}</span>
          </button>
          <button
            onClick={() => setActiveTab('stops')}
            style={{
              flex: 1,
              padding: '8px 4px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'stops' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'stops' ? 'var(--text-on-primary)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <MapPin size={14} />
            <span>{language === 'ar' ? 'المحطات' : 'Stops'}</span>
          </button>
          <button
            onClick={() => setActiveTab('passengers')}
            style={{
              flex: 1,
              padding: '8px 4px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'passengers' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'passengers' ? 'var(--text-on-primary)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <Users size={14} />
            <span>{language === 'ar' ? 'الركاب' : 'Passengers'}</span>
          </button>
        </div>

        {/* Tab Content Box */}
        <div className="glass-card" style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          maxHeight: '260px',
          overflowY: 'auto'
        }}>
          
          {/* TAB 1: TELEMETRY & SPEED */}
          {activeTab === 'telemetry' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Circular Speedometer Arc */}
              <div style={{
                position: 'relative',
                width: '84px',
                height: '84px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="84" height="84" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.04)"
                    strokeWidth="7"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="7"
                    strokeDasharray={2 * Math.PI * 42}
                    strokeDashoffset={2 * Math.PI * 42 - (Math.min(speed, 90) / 90) * (2 * Math.PI * 42)}
                    strokeLinecap="round"
                    style={{
                      transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                      transform: 'rotate(-90deg)',
                      transformOrigin: '50% 50%'
                    }}
                  />
                </svg>
                <div style={{
                  position: 'absolute',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span className="title-outfit" style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {Math.round(speed)}
                  </span>
                  <span style={{ fontSize: '8px', color: 'var(--primary)', fontWeight: 800, letterSpacing: '0.05em', marginTop: '1px' }}>
                    KM/H
                  </span>
                </div>
              </div>

              {/* GPS Information controls */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: isStreaming ? 'var(--success)' : 'var(--text-muted)',
                      boxShadow: isStreaming ? '0 0 10px var(--success)' : 'none',
                      animation: isStreaming ? 'pulse-opacity 1.5s infinite' : 'none'
                    }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {isStreaming ? t('liveGpsBroadcast') : t('gpsStandby')}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace', margin: '2px 0' }}>
                  {currentCoords 
                    ? `${currentCoords.lat.toFixed(5)}, ${currentCoords.lng.toFixed(5)}` 
                    : (language === 'ar' ? 'بانتظار إحداثيات GPS...' : 'Awaiting GPS coordinates...')}
                </div>
                <button
                  onClick={() => {
                    if (isStreaming) {
                      stopLocationStream();
                    } else {
                      startLocationStream();
                    }
                  }}
                  className="btn"
                  style={{
                    fontSize: '11px',
                    padding: '6px 12px',
                    marginTop: '4px',
                    width: 'fit-content',
                    background: isStreaming ? 'rgba(239, 68, 68, 0.15)' : 'var(--primary)',
                    color: isStreaming ? '#ef4444' : 'var(--text-on-primary)',
                    border: isStreaming ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {isStreaming ? t('stopBroadcasting') : t('startLiveGps')}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: STOPS CHECKLIST */}
          {activeTab === 'stops' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '4px' }}>
                {t('stopsTimeline')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {trip?.routeId?.checkpoints && trip.routeId.checkpoints.length > 0 ? (
                  trip.routeId.checkpoints.map((cp: any, idx: number) => {
                    const isArrived = arrivedCheckpoints.includes(cp.name);
                    const cpName = language === 'ar' ? (cp.nameAr || cp.name) : cp.name;
                    
                    const cpCoords = cp.location?.coordinates || cp.coordinates;
                    let distanceMeters: number | null = null;
                    if (cpCoords && currentCoords) {
                      distanceMeters = getDistanceInMeters(currentCoords.lat, currentCoords.lng, cpCoords[1], cpCoords[0]);
                    }

                    return (
                      <div key={idx} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        gap: '8px',
                        position: 'relative',
                        paddingBottom: idx === trip.routeId.checkpoints.length - 1 ? 0 : '16px'
                      }}>
                        {/* Timeline vertical line */}
                        {idx !== trip.routeId.checkpoints.length - 1 && (
                          <>
                            {/* Glowing neon blur layer */}
                            <div style={{
                              position: 'absolute',
                              left: isRtl ? 'auto' : '8px',
                              right: isRtl ? '8px' : 'auto',
                              top: '20px',
                              bottom: 0,
                              width: '4px',
                              background: isArrived ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                              filter: 'blur(2px)',
                              zIndex: 1
                            }} />
                            {/* Main solid line */}
                            <div style={{
                              position: 'absolute',
                              left: isRtl ? 'auto' : '9px',
                              right: isRtl ? '9px' : 'auto',
                              top: '20px',
                              bottom: 0,
                              width: '2px',
                              background: isArrived ? 'var(--success)' : 'rgba(255, 255, 255, 0.08)',
                              zIndex: 1
                            }} />
                          </>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: isArrived ? 'var(--success)' : 'rgba(18, 22, 33, 0.85)',
                            border: `2px solid ${isArrived ? 'var(--success)' : 'rgba(255, 255, 255, 0.12)'}`,
                            color: isArrived ? '#fff' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '9px',
                            fontWeight: 800,
                            flexShrink: 0,
                            boxShadow: isArrived ? '0 0 8px rgba(16, 185, 129, 0.3)' : 'none',
                            zIndex: 2
                          }}>
                            {isArrived ? <Check size={10} strokeWidth={3} /> : idx + 1}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <span style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: isArrived ? 'var(--text-muted)' : 'var(--text-primary)',
                              textDecoration: isArrived ? 'line-through' : 'none',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {cpName}
                            </span>
                            {distanceMeters !== null && !isArrived && (
                              <span style={{ fontSize: '9px', color: 'var(--primary)' }}>
                                {t('currentDistance', { distance: Math.round(distanceMeters) })}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleToggleCheckpoint(cp.name)}
                          disabled={actionLoading}
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '4px 8px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            background: isArrived ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 183, 49, 0.12)',
                            border: `1px solid ${isArrived ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 183, 49, 0.25)'}`,
                            color: isArrived ? 'var(--success)' : 'var(--primary)',
                            minHeight: '28px',
                            minWidth: '64px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            outline: 'none'
                          }}
                        >
                          {isArrived ? (language === 'ar' ? 'وصلت' : 'Arrived') : (language === 'ar' ? 'تأكيد' : 'Arrive')}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {language === 'ar' ? 'لا توجد محطات مسجلة.' : 'No checkpoints registered.'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PASSENGER MANIFEST */}
          {activeTab === 'passengers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {t('passengerList', { count: manifest.length })}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--primary)' }}>
                  {language === 'ar' ? 'الصعود: ' : 'Boarded: '}
                  {manifest.filter(b => b.status === 'BOARDED' || b.isCheckedIn).length} / {manifest.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {manifest.length > 0 ? (
                  manifest.map((booking: any, idx: number) => {
                    const isBoarded = booking.status === 'BOARDED' || booking.isCheckedIn;
                    const name = booking.userId?.name || `Passenger #${idx + 1}`;
                    const phone = booking.userId?.phone || '';

                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.04)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)',
                            flexShrink: 0
                          }}>
                            <Users size={12} />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {name}
                            </span>
                            {phone && (
                              <a href={`tel:${phone}`} style={{ fontSize: '9px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}>
                                <Phone size={8} />
                                {phone}
                              </a>
                            )}
                          </div>
                        </div>

                        <div>
                          {isBoarded ? (
                            <span className="status-tag in-transit" style={{ fontSize: '9px', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                              {t('onBoard')}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleCheckInPassenger(booking._id)}
                              disabled={actionLoading}
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '4px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                background: 'linear-gradient(135deg, #F5B731 0%, #E5A520 100%)',
                                border: 'none',
                                color: 'var(--text-on-primary)',
                                minHeight: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                outline: 'none'
                              }}
                            >
                              {t('checkInBtn')}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {t('noPassengersBooked')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Dynamic pulse-opacity animation for the streaming indicator */}
      <style>{`
        @keyframes pulse-opacity {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
