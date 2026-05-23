import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { socketService } from '../services/socket';
import api from '../services/api';

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

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>


      <div style={{ flex: 1, position: 'relative' }}>
        {!location && (
          <div className="tracking-gps-banner">
            Waiting for GPS signal from vehicle...
          </div>
        )}
        
        <MapContainer center={center as [number, number]} zoom={14} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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

        {/* Floating Developer Sandbox Controller */}
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
