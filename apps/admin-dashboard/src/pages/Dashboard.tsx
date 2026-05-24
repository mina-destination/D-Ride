import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bus, CarFront, Banknote, Users, User, CreditCard, AlertTriangle, Activity, Flame } from 'lucide-react';
import { bookingsAPI } from '../services/api';

const routePaths: Record<string, [number, number][]> = {
  '1': [
    [30.0444, 31.2357],
    [30.0480, 31.2280],
    [30.0520, 31.2150],
    [30.0560, 31.2020],
    [30.0620, 31.1850],
    [30.0680, 31.1680]
  ],
  '2': [
    [30.0770, 31.3400],
    [30.0720, 31.3520],
    [30.0650, 31.3680],
    [30.0550, 31.3850],
    [30.0420, 31.4050]
  ],
  '3': [
    [30.0130, 31.2080],
    [30.0050, 31.1850],
    [29.9950, 31.1620],
    [29.9820, 31.1350],
    [29.9680, 31.1080]
  ]
};

function MapPanController({ panTo }: { panTo: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (panTo) {
      map.flyTo(panTo, 13, { animate: true, duration: 1.2 });
    }
  }, [panTo, map]);
  return null;
}

// Fix for default marker icon in react-leaflet inside Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom active shuttle marker icon
const activeBusIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35],
});

interface ActiveBus {
  id: string;
  plate: string;
  route: string;
  driver: string;
  lat: number;
  lng: number;
  seats: string;
  speed: number;
}

export default function DashboardPage() {
  const [fleet, setFleet] = useState<ActiveBus[]>([
    {
      id: '1',
      plate: 'ABC-123',
      route: 'Maadi → Smart Village',
      driver: 'Capt. Mohamed Soliman',
      lat: 30.0444,
      lng: 31.2357,
      seats: '12 / 14',
      speed: 48,
    },
    {
      id: '2',
      plate: 'XYZ-789',
      route: 'Heliopolis → New Cairo',
      driver: 'Capt. Tarek Hegazi',
      lat: 30.0770,
      lng: 31.3400,
      seats: '8 / 14',
      speed: 55,
    },
    {
      id: '3',
      plate: 'QWE-456',
      route: 'Nasr City → 6th October',
      driver: 'Capt. Ahmed Abdelrahman',
      lat: 30.0130,
      lng: 31.2080,
      seats: '14 / 14 (Full)',
      speed: 0, // Stopped at station
    },
  ]);

  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [mapPanTo, setMapPanTo] = useState<[number, number] | null>(null);

  // OSRM street path and Heatmap states
  const [selectedRoutePath, setSelectedRoutePath] = useState<[number, number][]>([]);
  const [mapViewMode, setMapViewMode] = useState<'FLEET' | 'HEATMAP'>('FLEET');
  const [bookings, setBookings] = useState<any[]>([]);

  // Fetch bookings for demand heatmap
  useEffect(() => {
    bookingsAPI.getAll()
      .then(data => setBookings(data))
      .catch(console.error);
  }, []);

  // Fetch OSRM route curves for selected vehicle route
  useEffect(() => {
    if (!selectedBusId) {
      setSelectedRoutePath([]);
      return;
    }
    const points = routePaths[selectedBusId];
    if (!points || points.length < 2) return;

    const fetchRoute = async () => {
      const coordsString = points
        .map(p => `${p[1]},${p[0]}`) // Lng, Lat
        .join(';');
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          const coords = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
          setSelectedRoutePath(coords);
        } else {
          setSelectedRoutePath(points);
        }
      } catch (err) {
        console.warn("OSRM routing failed on dashboard, falling back to static points:", err);
        setSelectedRoutePath(points);
      }
    };
    fetchRoute();
  }, [selectedBusId]);

  // Simulate active GPS vehicle tracking telemetry
  useEffect(() => {
    const interval = setInterval(() => {
      setFleet((prevFleet) =>
        prevFleet.map((bus) => {
          if (bus.speed === 0) return bus; // Stopped bus doesn't move
          
          // Sightly alter coordinate vectors to simulate driving
          const latDelta = (Math.random() - 0.5) * 0.0015;
          const lngDelta = (Math.random() - 0.5) * 0.0015;
          return {
            ...bus,
            lat: bus.lat + latDelta,
            lng: bus.lng + lngDelta,
            speed: Math.max(30, Math.min(80, bus.speed + Math.floor((Math.random() - 0.5) * 10))),
          };
        })
      );
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="dashboard-welcome">
        <h1>Good evening, Admin 👋</h1>
        <p>Here's what's happening with D-Ride today.</p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: '2rem' }}>
        <div className="kpi-card amber">
          <div className="kpi-header">
            <div className="kpi-icon amber" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bus size={20} /></div>
            <span className="kpi-trend up">↑ 12%</span>
          </div>
          <div className="kpi-value">1,284</div>
          <div className="kpi-label">Total Trips Today</div>
        </div>

        <div className="kpi-card green">
          <div className="kpi-header">
            <div className="kpi-icon green" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CarFront size={20} /></div>
            <span className="kpi-trend up">↑ 4%</span>
          </div>
          <div className="kpi-value">186</div>
          <div className="kpi-label">Active Vehicles</div>
        </div>

        <div className="kpi-card blue">
          <div className="kpi-header">
            <div className="kpi-icon blue" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Banknote size={20} /></div>
            <span className="kpi-trend up">↑ 18%</span>
          </div>
          <div className="kpi-value">EGP 47,520</div>
          <div className="kpi-label">Revenue Today</div>
        </div>

        <div className="kpi-card red">
          <div className="kpi-header">
            <div className="kpi-icon red" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={20} /></div>
            <span className="kpi-trend down">↓ 2%</span>
          </div>
          <div className="kpi-value">3,847</div>
          <div className="kpi-label">Active Passengers</div>
        </div>
      </div>

      {/* Live Fleet Tracking Map Hub */}
      <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: 'var(--radius-xl)' }}>
        <div className="card-header" style={{ marginBottom: '1rem', borderBottom: 'none' }}>
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={20} /> Live Fleet Control Center
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Real-time telemetry and GPS coordinates of active passenger shuttles driving in Cairo
            </p>
          </div>
          <span className="status-badge confirmed" style={{ animation: 'pulse 2s infinite' }}>
            ● LIVE TELEMETRY
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', height: '420px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', zIndex: 1 }}>
          
          {/* Shuttles Sidebar */}
          <div style={{ background: 'var(--surface-elevated)', overflowY: 'auto', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              ONLINE SHUTTLES ({fleet.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {fleet.map((bus) => {
                const isSelected = selectedBusId === bus.id;
                return (
                  <div 
                    key={bus.id}
                    onClick={() => {
                      setSelectedBusId(bus.id);
                      setMapPanTo([bus.lat, bus.lng]);
                    }}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(245, 183, 49, 0.08)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                      transition: 'all 0.2s',
                      textAlign: 'left'
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>🚐 {bus.plate}</strong>
                      <span style={{ fontSize: '10.5px', color: bus.speed > 0 ? 'var(--success)' : 'var(--text-muted)', fontWeight: 'bold' }}>
                        {bus.speed > 0 ? `${bus.speed} km/h` : 'Stopped'}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {bus.route}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {bus.driver.split(' ').slice(1).join(' ')} · {bus.seats}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Map Container */}
          <div style={{ position: 'relative', height: '100%' }}>
            {/* View Mode Toggle Controls Overlay */}
            <div style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              zIndex: 1000,
              display: 'flex',
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '2px',
              boxShadow: 'var(--shadow-md)',
            }}>
              <button
                type="button"
                onClick={() => setMapViewMode('FLEET')}
                style={{
                  background: mapViewMode === 'FLEET' ? 'var(--primary-color)' : 'transparent',
                  color: mapViewMode === 'FLEET' ? 'black' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Activity size={12} />
                Fleet Track
              </button>
              <button
                type="button"
                onClick={() => setMapViewMode('HEATMAP')}
                style={{
                  background: mapViewMode === 'HEATMAP' ? 'var(--primary-color)' : 'transparent',
                  color: mapViewMode === 'HEATMAP' ? 'black' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Flame size={12} />
                Demand Heatmap
              </button>
            </div>

            <MapContainer center={[30.0444, 31.2357]} zoom={12} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* FLEET VIEW */}
              {mapViewMode === 'FLEET' && (
                <>
                  {fleet.map((bus) => (
                    <Marker key={bus.id} position={[bus.lat, bus.lng]} icon={activeBusIcon}>
                      <Popup>
                        <div style={{ minWidth: '180px', padding: '0.25rem' }}>
                          <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary-color)', fontSize: '0.95rem' }}>
                            Shuttle {bus.plate}
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem' }}>
                            <span><strong>Driver:</strong> {bus.driver}</span>
                            <span><strong>Route:</strong> {bus.route}</span>
                            <span><strong>Speed:</strong> {bus.speed} km/h</span>
                            <span><strong>Occupancy:</strong> {bus.seats} booked</span>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                  {selectedBusId && selectedRoutePath.length > 0 && (
                    <Polyline
                      positions={selectedRoutePath}
                      color="var(--primary)"
                      weight={4}
                      opacity={0.85}
                      dashArray="8, 8"
                    />
                  )}
                </>
              )}

              {/* DEMAND HEATMAP VIEW */}
              {mapViewMode === 'HEATMAP' && (
                <>
                  {bookings
                    .filter((b) => b.pickupCheckpoint)
                    .map((booking, idx) => {
                      const pickup = booking.pickupCheckpoint;
                      const coords = pickup.location?.coordinates || pickup.coordinates;
                      if (!coords || coords.length < 2) return null;
                      return (
                        <CircleMarker
                          key={idx}
                          center={[coords[1], coords[0]]}
                          radius={18}
                          pathOptions={{
                            fillColor: '#ef4444',
                            fillOpacity: 0.28,
                            color: '#f59e0b',
                            weight: 1,
                            opacity: 0.6,
                          }}
                        >
                          <Popup>
                            <div style={{ padding: '0.15rem' }}>
                              <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: '#ef4444' }}>Demand Area Hotspot</h4>
                              <div style={{ fontSize: '0.78rem' }}>
                                <strong>Station:</strong> {pickup.name}<br />
                                <strong>Fare:</strong> {booking.amountEGP} EGP<br />
                                <strong>Status:</strong> {booking.status}
                              </div>
                            </div>
                          </Popup>
                        </CircleMarker>
                      );
                    })}
                </>
              )}

              {mapPanTo && <MapPanController panTo={mapPanTo} />}
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Bookings SVG Line Chart */}
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Commute Bookings Trend</h3>
            <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600 }}>+14.2% weekly growth</span>
          </div>
          <div style={{ position: 'relative', width: '100%', height: '160px' }}>
            <svg viewBox="0 0 500 150" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line x1="0" y1="20" x2="500" y2="20" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="5 5" />
              <line x1="0" y1="70" x2="500" y2="70" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="5 5" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="5 5" />
              
              {/* Area path */}
              <path d="M 10,130 L 10,120 Q 80,70 150,95 T 290,45 T 430,60 T 490,20 L 490,130 Z" fill="url(#lineGrad)" />
              {/* Line path */}
              <path d="M 10,120 Q 80,70 150,95 T 290,45 T 430,60 T 490,20" fill="none" stroke="var(--primary)" strokeWidth="3" />
              
              {/* Data points */}
              <circle cx="10" cy="120" r="4" fill="#000" stroke="var(--primary)" strokeWidth="2" />
              <circle cx="95" cy="78" r="4" fill="#000" stroke="var(--primary)" strokeWidth="2" />
              <circle cx="200" cy="85" r="4" fill="#000" stroke="var(--primary)" strokeWidth="2" />
              <circle cx="290" cy="45" r="4" fill="#000" stroke="var(--primary)" strokeWidth="2" />
              <circle cx="370" cy="55" r="4" fill="#000" stroke="var(--primary)" strokeWidth="2" />
              <circle cx="430" cy="60" r="4" fill="#000" stroke="var(--primary)" strokeWidth="2" />
              <circle cx="490" cy="20" r="4" fill="var(--primary)" stroke="var(--surface)" strokeWidth="2" />
              
              {/* Labels */}
              <text x="10" y="145" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Mon</text>
              <text x="95" y="145" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Tue</text>
              <text x="200" y="145" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Wed</text>
              <text x="290" y="145" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Thu</text>
              <text x="370" y="145" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Fri</text>
              <text x="430" y="145" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Sat</text>
              <text x="490" y="145" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Sun</text>
            </svg>
          </div>
        </div>

        {/* Revenue SVG Bar Chart */}
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Daily Checkout Revenue</h3>
            <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>Target: EGP 50,000</span>
          </div>
          <div style={{ position: 'relative', width: '100%', height: '160px' }}>
            <svg viewBox="0 0 500 150" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              {/* Horizontal helper grid lines */}
              <line x1="0" y1="20" x2="500" y2="20" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="5 5" />
              <line x1="0" y1="70" x2="500" y2="70" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="5 5" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="5 5" />

              {/* Bar 1 */}
              <rect x="25" y="45" width="28" height="85" fill="var(--primary)" rx="4" opacity="0.85" />
              <text x="39" y="145" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Cairo</text>
              {/* Bar 2 */}
              <rect x="105" y="70" width="28" height="60" fill="var(--success)" rx="4" opacity="0.85" />
              <text x="119" y="145" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Giza</text>
              {/* Bar 3 */}
              <rect x="185" y="30" width="28" height="100" fill="var(--info)" rx="4" opacity="0.85" />
              <text x="199" y="145" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Alex</text>
              {/* Bar 4 */}
              <rect x="265" y="80" width="28" height="50" fill="var(--warning)" rx="4" opacity="0.85" />
              <text x="279" y="145" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Maadi</text>
              {/* Bar 5 */}
              <rect x="345" y="55" width="28" height="75" fill="var(--primary)" rx="4" opacity="0.85" />
              <text x="359" y="145" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Helio</text>
              {/* Bar 6 */}
              <rect x="425" y="95" width="28" height="35" fill="var(--text-secondary)" rx="4" opacity="0.8" />
              <text x="439" y="145" fill="var(--text-muted)" fontSize="9" textAnchor="middle">Oct</text>
            </svg>
          </div>
        </div>

        {/* Fleet Capacity Utilization Donut Chart */}
        <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Fleet Seat Occupancy</h3>
            <span className="status-badge confirmed" style={{ padding: '2px 8px', fontSize: '9px' }}>Optimal</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', height: '160px', gap: '8px' }}>
            <div style={{ position: 'relative', width: '100px', height: '100px' }}>
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%' }}>
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="3.5"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="3.5"
                  strokeDasharray="81, 100"
                />
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>81%</div>
                <div style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Utilized</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></span>
                <span><strong>34</strong> Seats Booked</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--border)' }}></span>
                <span><strong>8</strong> Seats Free</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></span>
                <span><strong>74.3%</strong> Avg Load</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Recent Bookings Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Bookings</h3>
            <span className="card-action">View All →</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Passenger</th>
                <th>Route</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className="table-user">
                    <div className="table-avatar" style={{ background: 'rgba(245,183,49,0.15)', color: '#F5B731' }}>AH</div>
                    <div>
                      <div className="table-user-name">Ahmed Hassan</div>
                      <div className="table-user-email">ahmed@mail.com</div>
                    </div>
                  </div>
                </td>
                <td>Maadi → Smart Village</td>
                <td style={{ fontWeight: 600 }}>EGP 45</td>
                <td><span className="status-badge confirmed">Confirmed</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>2 min ago</td>
              </tr>
              <tr>
                <td>
                  <div className="table-user">
                    <div className="table-avatar" style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>SM</div>
                    <div>
                      <div className="table-user-name">Sara Mohamed</div>
                      <div className="table-user-email">sara@mail.com</div>
                    </div>
                  </div>
                </td>
                <td>Heliopolis → New Cairo</td>
                <td style={{ fontWeight: 600 }}>EGP 35</td>
                <td><span className="status-badge confirmed">Confirmed</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>5 min ago</td>
              </tr>
              <tr>
                <td>
                  <div className="table-user">
                    <div className="table-avatar" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>OE</div>
                    <div>
                      <div className="table-user-name">Omar El-Sayed</div>
                      <div className="table-user-email">omar@mail.com</div>
                    </div>
                  </div>
                </td>
                <td>Nasr City → 6th October</td>
                <td style={{ fontWeight: 600 }}>EGP 55</td>
                <td><span className="status-badge pending">Pending</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>8 min ago</td>
              </tr>
              <tr>
                <td>
                  <div className="table-user">
                    <div className="table-avatar" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>NK</div>
                    <div>
                      <div className="table-user-name">Nadia Khalil</div>
                      <div className="table-user-email">nadia@mail.com</div>
                    </div>
                  </div>
                </td>
                <td>Dokki → Mohandessin</td>
                <td style={{ fontWeight: 600 }}>EGP 25</td>
                <td><span className="status-badge cancelled">Cancelled</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>15 min ago</td>
              </tr>
              <tr>
                <td>
                  <div className="table-user">
                    <div className="table-avatar" style={{ background: 'rgba(245,183,49,0.15)', color: '#F5B731' }}>YA</div>
                    <div>
                      <div className="table-user-name">Youssef Ali</div>
                      <div className="table-user-email">youssef@mail.com</div>
                    </div>
                  </div>
                </td>
                <td>Zamalek → Downtown</td>
                <td style={{ fontWeight: 600 }}>EGP 20</td>
                <td><span className="status-badge confirmed">Confirmed</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>22 min ago</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Activity Feed */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Activity</h3>
            <span className="card-action">See All</span>
          </div>
          <div className="card-body">
            <div className="activity-list">
              <div className="activity-item">
                <div className="activity-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bus size={16} /></div>
                <div>
                  <div className="activity-text">
                    <strong>Trip #1284</strong> departed from Maadi station on schedule
                  </div>
                  <div className="activity-time">3 minutes ago</div>
                </div>
              </div>
              <div className="activity-item">
                <div className="activity-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CreditCard size={16} /></div>
                <div>
                  <div className="activity-text">
                    <strong>Payment received</strong> — EGP 45 from Ahmed Hassan via Paymob
                  </div>
                  <div className="activity-time">5 minutes ago</div>
                </div>
              </div>
              <div className="activity-item">
                <div className="activity-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CarFront size={16} /></div>
                <div>
                  <div className="activity-text">
                    <strong>Vehicle ABC-123</strong> went online in Heliopolis zone
                  </div>
                  <div className="activity-time">12 minutes ago</div>
                </div>
              </div>
              <div className="activity-item">
                <div className="activity-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={16} /></div>
                <div>
                  <div className="activity-text">
                    <strong>Driver Mohamed</strong> completed 15 trips today — new personal record
                  </div>
                  <div className="activity-time">28 minutes ago</div>
                </div>
              </div>
              <div className="activity-item">
                <div className="activity-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertTriangle size={16} /></div>
                <div>
                  <div className="activity-text">
                    <strong>Route 7</strong> — 10 minute delay reported near Ring Road exit
                  </div>
                  <div className="activity-time">35 minutes ago</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
