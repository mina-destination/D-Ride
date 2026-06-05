import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { socketService } from '../services/socket';
import { driverAPI } from '../services/api';
import { ArrowLeft, Play, Square, AlertTriangle, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';

// Fix for default marker icon in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const driverBusIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

export default function LiveDrivePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language, setLanguage, isRtl } = useTranslation();

  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [streetPath, setStreetPath] = useState<[number, number][]>([]);
  
  // Streaming status
  const [isStreaming, setIsStreaming] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  
  // Simulation fallback state (in case browser denies geolocation or local testing on desktop)
  const [isMocking, setIsMocking] = useState(false);
  const [lockCenter, setLockCenter] = useState(true);
  
  const geoWatchId = useRef<number | null>(null);
  const mockIntervalId = useRef<any>(null);

  // Load trip details
  useEffect(() => {
    const fetchTrip = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const trips = await driverAPI.getMyTrips();
        const currentTrip = trips.find((t: any) => t._id === id);
        setTrip(currentTrip);
      } catch (error) {
        console.error('Failed to load trip', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTrip();
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

  // Connect socket on mount, disconnect on unmount
  useEffect(() => {
    socketService.connect();
    return () => {
      stopLocationStream();
      socketService.disconnect();
    };
  }, []);

  const startLocationStream = () => {
    if (isStreaming) return;
    setIsStreaming(true);
    setGpsError(null);

    // Cairo starting position
    let startLat = 30.0444;
    let startLng = 31.2357;
    
    if (trip?.routeId?.path?.coordinates?.length > 0) {
      // Start at route coordinate if available
      const firstCoord = trip.routeId.path.coordinates[0];
      startLng = firstCoord[0];
      startLat = firstCoord[1];
    }
    
    setCurrentCoords({ lat: startLat, lng: startLng });

    // 1. Try real GPS via Geolocation API
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCurrentCoords({ lat, lng });
          
          // Send location update to WebSocket Server
          socketService.sendLocation({
            vehicleId: trip?.vehicleId?._id || 'mock-vehicle-123',
            driverId: user?._id || 'mock-driver-123',
            longitude: lng,
            latitude: lat,
          });
        },
        (error) => {
          console.warn('GPS error, switching to simulator option:', error.message);
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

  // Mock drive coordinate simulation along the route checkpoints or Cairo street path
  const startMockSimulation = (initLat: number, initLng: number) => {
    let lat = initLat;
    let lng = initLng;
    let step = 0;

    // Use OSM streetPath coordinates if fetched successfully, otherwise fallback
    const mockRoutePath = streetPath.length > 0
      ? streetPath.map(c => [c[1], c[0]])
      : (trip?.routeId?.path?.coordinates || [
          [31.2357, 30.0444],
          [31.2320, 30.0455],
          [31.2290, 30.0470],
          [31.2250, 30.0490],
          [31.2210, 30.0520],
          [31.2170, 30.0560],
          [31.2140, 30.0600],
          [31.2160, 30.0640],
          [31.2210, 30.0660],
          [31.2250, 30.0630],
        ]);

    mockIntervalId.current = setInterval(() => {
      const nextCoord = mockRoutePath[step % mockRoutePath.length];
      lng = nextCoord[0];
      lat = nextCoord[1];
      step++;

      setCurrentCoords({ lat, lng });

      // Stream to WebSocket
      socketService.sendLocation({
        vehicleId: trip?.vehicleId?._id || 'mock-vehicle-123',
        driverId: user?._id || 'mock-driver-123',
        longitude: lng,
        latitude: lat,
      });
    }, 3000);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 24px' }}>
        <span>{t('initializingMap')}</span>
      </div>
    );
  }

  const mapCenter = currentCoords ? [currentCoords.lat, currentCoords.lng] : [30.0444, 31.2357];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* Top Header Floating Card */}
      <div style={{
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
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-md)',
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={20} style={{ transform: isRtl ? 'rotate(180deg)' : 'none' }} />
        </button>

        <div className="glass-card" style={{ flex: 1, padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
            {t('activeRouteLabel')}
          </span>
          <h3 className="title-outfit" style={{ fontSize: '14px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {trip?.routeId?.name || t('drivingRoute')}
          </h3>
        </div>

        <button
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-md)',
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }}
          title={language === 'en' ? 'العربية' : 'English'}
        >
          <Globe size={20} />
        </button>
      </div>

      {/* Map Element */}
      <div style={{ flex: 1, height: '100%', width: '100%', zIndex: 0 }}>
        <MapContainer center={mapCenter as [number, number]} zoom={15} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          {streetPath.length > 0 && (
            <Polyline positions={streetPath} color="#f5b731" weight={5} opacity={0.8} />
          )}
          {trip?.routeId?.checkpoints?.map((cp: any, idx: number) => {
            const coords = cp.location?.coordinates || cp.coordinates;
            if (!coords) return null;
            return (
              <Marker 
                key={cp._id || idx} 
                position={[coords[1], coords[0]]}
              >
                <Tooltip permanent direction="top" offset={[0, -10]}>
                  <span style={{ color: '#000', fontWeight: 'bold' }}>
                    {language === 'ar' ? (cp.nameAr || cp.name) : cp.name}
                  </span>
                </Tooltip>
              </Marker>
            );
          })}
          {currentCoords && (
            <Marker position={[currentCoords.lat, currentCoords.lng]} icon={driverBusIcon} />
          )}
          {currentCoords && lockCenter && <MapCenterUpdater coords={currentCoords} />}
        </MapContainer>
      </div>

      {/* GPS Alert Warning Banner */}
      {gpsError && (
        <div style={{
          position: 'absolute',
          bottom: '160px',
          left: '16px',
          right: '16px',
          zIndex: 1000,
          background: 'rgba(245, 158, 11, 0.95)',
          color: '#0e0e1b',
          padding: '10px 16px',
          borderRadius: 'var(--radius-md)',
          fontSize: '12px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: 'var(--shadow-md)'
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
        gap: '12px'
      }}>
        <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: isStreaming ? 'var(--success)' : 'var(--text-muted)',
                boxShadow: isStreaming ? '0 0 10px var(--success)' : 'none',
                animation: isStreaming ? 'pulse-opacity 1.5s infinite' : 'none'
              }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {isStreaming ? (isMocking ? t('simulatedTelemetry') : t('liveGpsBroadcast')) : t('gpsStandby')}
              </span>
            </div>
            {currentCoords && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}
                </span>
                <button
                  onClick={() => setLockCenter(!lockCenter)}
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    color: lockCenter ? 'var(--primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                >
                  {lockCenter 
                    ? (language === 'ar' ? '🔒 قفل المنظور' : '🔒 Lock GPS View') 
                    : (language === 'ar' ? '🔓 تحريك الخريطة' : '🔓 Free Map Pan')}
                </button>
              </div>
            )}
          </div>

          {isStreaming ? (
            <button
              onClick={stopLocationStream}
              className="btn btn-danger btn-block"
              style={{ height: '48px' }}
            >
              <Square size={18} fill="white" />
              {t('stopBroadcasting')}
            </button>
          ) : (
            <button
              onClick={startLocationStream}
              className="btn btn-primary btn-block"
              style={{ height: '48px' }}
            >
              <Play size={18} />
              {t('startLiveGps')}
            </button>
          )}
        </div>
      </div>
      
      {/* Dynamic blink animation */}
      <style>{`
        @keyframes pulse-opacity {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

// Map center tracking updates helper component
function MapCenterUpdater({ coords }: { coords: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([coords.lat, coords.lng], map.getZoom());
  }, [coords.lat, coords.lng, map]);
  return null;
}
