import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { socketService } from '../services/socket';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { Microscope, Square, Rocket } from 'lucide-react';

// Fix for default marker icon in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Create a custom bus icon
const busIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

export default function LiveTrackingPage() {
  const { theme } = useTheme();
  const mapTileUrl = theme === 'dark'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  const mapTileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  const [searchParams] = useSearchParams();
  const vehicleId = searchParams.get('vehicleId');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [trip, setTrip] = useState<any>(null);

  // Load trip details to draw the route path on the map
  useEffect(() => {
    const tripId = searchParams.get('tripId');
    if (!tripId) return;

    api.get(`/trips/${tripId}`)
      .then(data => setTrip(data))
      .catch(console.error);
  }, [searchParams]);

  const polylinePath = trip?.routeId?.path?.coordinates?.map(
    (coord: number[]) => [coord[1], coord[0]] as [number, number]
  ) || [];

  // Dev tools sandbox telemetry simulator
  const [isSimulating, setIsSimulating] = useState(false);
  const [simInterval, setSimInterval] = useState<any>(null);

  useEffect(() => {
    if (!vehicleId) return;

    socketService.connect();
    socketService.subscribeToVehicle(vehicleId);

    const handleLocationUpdate = (data: any) => {
      if (data.vehicleId === vehicleId && data.location) {
        setLocation({ lat: data.location.latitude, lng: data.location.longitude });
      }
    };

    socketService.onVehicleLocationUpdate(handleLocationUpdate);

    return () => {
      socketService.unsubscribeFromVehicle(vehicleId);
      socketService.offVehicleLocationUpdate(handleLocationUpdate);
      socketService.disconnect();
    };
  }, [vehicleId]);

  useEffect(() => {
    return () => {
      if (simInterval) clearInterval(simInterval);
    };
  }, [simInterval]);

  const startLocalSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);

    // Mock Cairo path (starts downtown, drives through Zamalek / Ring Road)
    const mockPath = [
      [30.0444, 31.2357],
      [30.0455, 31.2320],
      [30.0470, 31.2290],
      [30.0490, 31.2250],
      [30.0520, 31.2210],
      [30.0560, 31.2170],
      [30.0600, 31.2140],
      [30.0640, 31.2160],
      [30.0660, 31.2210],
      [30.0630, 31.2250],
    ];

    let index = 0;
    const interval = setInterval(async () => {
      if (index >= mockPath.length) {
        index = 0; // loop coordinates
      }
      const [lat, lng] = mockPath[index];

      // Update locally immediately
      setLocation({ lat, lng });

      // Trigger full broadcast via socket loop endpoint
      try {
        const { default: api } = await import('../services/api');
        await api.post('/vehicles/location', {
          vehicleId: vehicleId || 'mock-vehicle-123',
          driverId: 'mock-driver-123',
          latitude: lat,
          longitude: lng,
        });
      } catch (e) {
        console.error('Failed sandbox location broadcast', e);
      }
      index++;
    }, 2000);

    setSimInterval(interval);
  };

  const stopLocalSimulation = () => {
    if (simInterval) {
      clearInterval(simInterval);
    }
    setIsSimulating(false);
    setSimInterval(null);
  };

  if (!vehicleId) {
    return (
      <div className="auth-page">
        <div className="auth-card glass" style={{ textAlign: 'center' }}>
          <h2>No Vehicle Selected</h2>
          <p>Please select a trip from your bookings to track.</p>
          <Link to="/my-trips" className="auth-button" style={{ marginTop: '1rem', display: 'inline-block' }}>Back to My Trips</Link>
        </div>
      </div>
    );
  }

  // Default center (Cairo) if location is not yet received
  const center = location ? [location.lat, location.lng] : [30.0444, 31.2357];
  const isSandboxEnabled = searchParams.get('sandbox') === 'true';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        
        {/* Floating Trip Status Info Drawer Card */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          width: '320px',
          maxHeight: 'calc(100% - 40px)',
          overflowY: 'auto',
          zIndex: 1000,
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(24px) saturate(1.2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: '1.25rem',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }} className="glass animate-fade-in-up">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              fontSize: '10px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              background: location ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: location ? 'var(--success)' : 'var(--danger)',
              padding: '4px 10px',
              borderRadius: '20px',
              border: `1px solid ${location ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: location ? 'var(--success)' : 'var(--danger)',
                animation: location ? 'pulse 2s infinite' : 'none'
              }} />
              {location ? 'Active GPS Tracking' : 'Vehicle Offline'}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>
              STATUS: {trip?.status || 'SCHEDULED'}
            </span>
          </div>

          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 0 0', lineHeight: 1.3 }}>
            {trip?.routeId?.name || 'Loading Route...'}
          </h3>

          <div style={{ background: 'var(--surface-elevated)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <strong>Scheduled Departure:</strong> {trip ? new Date(trip.departureTime).toLocaleString() : 'Loading...'}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />

          {/* Fallback Info for Offline State */}
          {!location ? (
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              ℹ️ <strong>Minibus details will update soon.</strong> The driver has not started broadcasting live GPS location yet. This usually starts 10-15 minutes prior to departure when the boarding gates open.
            </div>
          ) : (
            <div style={{ fontSize: '11.5px', color: 'var(--success)', fontWeight: 500 }}>
              🟢 Minibus is on route. Tracking coordinates broadcasted smoothly.
            </div>
          )}

          {/* Vehicle & Driver Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', margin: '4px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Vehicle Model:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                {trip?.vehicleId?.model ? `${trip.vehicleId.make || ''} ${trip.vehicleId.model}`.trim() : 'Toyota HiAce'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>License Plate:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                {trip?.vehicleId?.licensePlate || trip?.vehicleId?.plateNumber || 'ط ر ق ٥٤٣٢'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Driver Partner:</span>
              <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{trip?.driverId?.name || 'Capt. Mohamed Hegazi'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <a 
              href="tel:+201001234567" 
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontWeight: 700,
                fontSize: '11px',
                textAlign: 'center',
                textDecoration: 'none',
                transition: 'var(--transition-base)'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              📞 Call Operator
            </a>
            <button 
              onClick={() => alert('Support ticket created. D-Ride support agent will contact you shortly.')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                background: 'var(--primary)',
                color: 'var(--text-on-primary)',
                fontWeight: 700,
                fontSize: '11px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'var(--transition-base)'
              }}
            >
              💬 Support Chat
            </button>
          </div>
        </div>

        <MapContainer center={center as [number, number]} zoom={14} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution={mapTileAttribution}
            url={mapTileUrl}
          />
          {polylinePath.length > 0 && (
            <>
              <Polyline positions={polylinePath} color="var(--primary)" weight={5} opacity={0.8} />
              <Marker position={polylinePath[0]}>
                <Popup>🏁 Departure Terminal</Popup>
              </Marker>
              <Marker position={polylinePath[polylinePath.length - 1]}>
                <Popup>🏁 Destination Station</Popup>
              </Marker>
            </>
          )}
          {location && (
            <Marker position={[location.lat, location.lng]} icon={busIcon}>
              <Popup>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', color: 'var(--primary)' }}>Shuttle Active Location</h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Lat: {location.lat.toFixed(5)}, Lng: {location.lng.toFixed(5)}</span>
                </div>
              </Popup>
            </Marker>
          )}
          {location && <MapUpdater location={location} />}
        </MapContainer>

        {/* Floating Developer Sandbox Controller (conditional) */}
        {isSandboxEnabled && (
          <div className="tracking-sandbox-panel">
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span><Microscope size={14} /></span> TELEMETRY SANDBOX
            </div>
            <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)' }}>
              No admin tab open? Run a local simulated telemetry feed loop.
            </p>
            {isSimulating ? (
              <button 
                onClick={stopLocalSimulation}
                className="btn-danger-outline"
                style={{ minHeight: '36px', fontSize: '11px', padding: '6px 12px' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  Stop Sandbox <Square size={12} fill="currentColor" />
                </span>
              </button>
            ) : (
              <button 
                onClick={startLocalSimulation}
                className="btn-primary"
                style={{ minHeight: '36px', fontSize: '11px', padding: '6px 12px' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  Simulate Live Drive <Rocket size={12} />
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper component to center map when location changes
import { useMap } from 'react-leaflet';
function MapUpdater({ location }: { location: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([location.lat, location.lng], map.getZoom(), { animate: true });
  }, [location.lat, location.lng, map]);
  return null;
}
