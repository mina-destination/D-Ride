import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bus, CarFront, Banknote, Users, User, CreditCard, AlertTriangle, Activity } from 'lucide-react';

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

        <div style={{ height: '380px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', zIndex: 1 }}>
          <MapContainer center={[30.0444, 31.2357]} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {fleet.map((bus) => (
              <Marker key={bus.id} position={[bus.lat, bus.lng]} icon={activeBusIcon}>
                <Popup>
                  <div style={{ minWidth: '180px', padding: '0.25rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary-color)', fontSize: '0.95rem' }}>
                      🚐 Shuttle {bus.plate}
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
          </MapContainer>
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
