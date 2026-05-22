import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { routesAPI } from '../services/api';
import logo from '../assets/d-ride-logo.jpeg';
import { Map, MapPin, Search, Ticket, Bus, CreditCard, Snowflake, Zap } from 'lucide-react';

import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon in Vite react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Autopan hook to fit the polyline path perfectly
function RouteMapAutopan({ path }: { path: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (path.length > 0) {
      const bounds = L.latLngBounds(path);
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [path, map]);
  return null;
}

function RouteSearchForm() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedRouteDetails, setSelectedRouteDetails] = useState<any>(null);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    routesAPI.getAll().then((data) => setRoutes(data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedRoute) {
      const details = routes.find(r => r._id === selectedRoute);
      setSelectedRouteDetails(details);
      setSelectedCheckpoint(''); // Reset checkpoint when route changes
    } else {
      setSelectedRouteDetails(null);
      setSelectedCheckpoint('');
    }
  }, [selectedRoute, routes]);

  const handleSearch = () => {
    if (selectedRoute) {
      const checkpointQuery = selectedCheckpoint ? `&checkpointName=${encodeURIComponent(selectedCheckpoint)}` : '';
      navigate(`/search?routeId=${selectedRoute}${checkpointQuery}`);
    }
  };

  const polylinePath = selectedRouteDetails?.path?.coordinates?.map(
    (coord: number[]) => [coord[1], coord[0]] as [number, number]
  ) || [];

  return (
    <>
      <div className="search-group">
        <div className="search-field" style={{ borderBottom: 'none' }}>
          <span className="search-field-icon"><Map size={20} /></span>
          <select 
            value={selectedRoute} 
            onChange={(e) => setSelectedRoute(e.target.value)}
            style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', padding: '0.5rem', color: 'var(--text-primary)' }}
          >
            <option value="" disabled style={{ color: 'var(--text-secondary)' }}>Select a Route</option>
            {routes.map(r => (
              <option key={r._id} value={r._id} style={{ color: 'var(--text-primary)', background: 'var(--surface)' }}>{r.name}</option>
            ))}
          </select>
        </div>

        {selectedRouteDetails?.checkpoints && selectedRouteDetails.checkpoints.length > 0 && (
          <div className="search-field animate-fade-in-up" style={{ borderBottom: 'none' }}>
            <span className="search-field-icon"><MapPin size={20} /></span>
            <select 
              value={selectedCheckpoint} 
              onChange={(e) => setSelectedCheckpoint(e.target.value)}
              style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', padding: '0.5rem', color: 'var(--text-primary)' }}
            >
              <option value="" style={{ color: 'var(--text-secondary)', background: 'var(--surface)' }}>Any Boarding Checkpoint (Default)</option>
              {selectedRouteDetails.checkpoints.map((cp: any) => (
                <option key={cp.name} value={cp.name} style={{ color: 'var(--text-primary)', background: 'var(--surface)' }}>
                  {cp.name} {cp.nameAr ? `(${cp.nameAr})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {polylinePath.length > 0 && (
        <div style={{ height: '220px', borderRadius: '12px', overflow: 'hidden', margin: '1rem 0', border: '1px solid var(--border)', zIndex: 1 }}>
          <MapContainer center={[30.0444, 31.2357]} zoom={10} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Polyline positions={polylinePath} color="var(--primary)" weight={4} opacity={0.9} />
            <Marker position={polylinePath[0]}>
              <Popup>🏁 Departure Terminal</Popup>
            </Marker>
            <Marker position={polylinePath[polylinePath.length - 1]}>
              <Popup>🏁 Destination Station</Popup>
            </Marker>
            <RouteMapAutopan path={polylinePath} />
          </MapContainer>
        </div>
      )}

      <button 
        className="search-btn" 
        onClick={handleSearch}
        disabled={!selectedRoute}
        style={{ opacity: selectedRoute ? 1 : 0.5, cursor: selectedRoute ? 'pointer' : 'not-allowed', marginTop: '0.5rem' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          Search Trips <Search size={18} />
        </span>
      </button>
    </>
  );
}

export default function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      {/* ── Hero Section ─────────────────────────────────── */}
      <section className="hero-section" id="hero">
        <div className="hero-bg-gradient" />
        <div className="hero-bg-gradient-2" />

        <div className="hero-content">
          <div className="hero-text">
            <div className="hero-badge">
              <span className="hero-badge-dot" />
              Live Route Telemetry Enabled
            </div>
            <h1 className="hero-title">
              Your Daily<br />
              Commute,{' '}
              <span className="hero-title-accent">Reinvented.</span>
            </h1>
            <p className="hero-subtitle">
              Smart mass-transit for Cairo and beyond. Book your seat on
              comfortable, air-conditioned buses with fixed routes,
              real-time tracking, and cashless payments.
            </p>
            <div className="hero-actions">
              {isAuthenticated ? (
                <Link to="/my-trips" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Ticket size={20} /> My Trips
                </Link>
              ) : (
                <Link to="/register" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Bus size={20} /> Book a Ride
                </Link>
              )}
              <a href="#how-it-works" className="btn-secondary">
                Learn More →
              </a>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-card glass">
              <div className="hero-card-header">
                <div className="hero-card-icon"><MapPin size={24} /></div>
                <div>
                  <div className="hero-card-title">Find Your Route</div>
                  <div className="hero-card-subtitle">Select your destination</div>
                </div>
              </div>
              <RouteSearchForm />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ────────────────────────────────────── */}
      <div className="stats-bar">
        <div className="stat-card glass delay-1 animate-fade-in-up">
          <div className="stat-value">150+</div>
          <div className="stat-label">Daily Routes</div>
        </div>
        <div className="stat-card glass delay-2 animate-fade-in-up">
          <div className="stat-value">50K+</div>
          <div className="stat-label">Happy Riders</div>
        </div>
        <div className="stat-card glass delay-3 animate-fade-in-up">
          <div className="stat-value">200+</div>
          <div className="stat-label">Vehicles</div>
        </div>
        <div className="stat-card glass delay-4 animate-fade-in-up">
          <div className="stat-value">4.8⭐</div>
          <div className="stat-label">Avg Rating</div>
        </div>
      </div>

      {/* ── How It Works ─────────────────────────────────── */}
      <section className="section" id="how-it-works">
        <div className="section-header">
          <div className="section-badge">Simple & Fast</div>
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">
            Get from A to B in three simple steps. No haggling, no uncertainty — just a smooth, reliable commute.
          </p>
        </div>

        <div className="steps-grid">
          <div className="step-card glass delay-1 animate-fade-in-up">
            <div className="step-number">1</div>
            <div className="step-icon"><Search size={32} /></div>
            <h3 className="step-title">Search</h3>
            <p className="step-desc">
              Enter your pickup and destination. We'll show you the best available routes with live ETAs.
            </p>
          </div>
          <div className="step-card glass delay-2 animate-fade-in-up">
            <div className="step-number">2</div>
            <div className="step-icon"><Ticket size={32} /></div>
            <h3 className="step-title">Book</h3>
            <p className="step-desc">
              Select your preferred trip and pay securely through our integrated Paymob checkout. Instant confirmation.
            </p>
          </div>
          <div className="step-card glass delay-3 animate-fade-in-up">
            <div className="step-number">3</div>
            <div className="step-icon"><Bus size={32} /></div>
            <h3 className="step-title">Ride</h3>
            <p className="step-desc">
              Track your bus in real-time, board with your digital ticket, and enjoy a comfortable air-conditioned ride.
            </p>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────── */}
      <section className="section" id="features">
        <div className="section-header">
          <div className="section-badge">Why D-Ride</div>
          <h2 className="section-title">Built for Cairo's Streets</h2>
          <p className="section-subtitle">
            We understand the Egyptian commute. That's why every feature is designed to make your daily journey better.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card glass delay-1 animate-fade-in-up">
            <div className="feature-icon"><MapPin size={28} /></div>
            <div>
              <h3 className="feature-title">Real-Time GPS Tracking</h3>
              <p className="feature-desc">
                Know exactly where your bus is. Live location updates every few seconds so you never miss your ride.
              </p>
            </div>
          </div>
          <div className="feature-card glass delay-2 animate-fade-in-up">
            <div className="feature-icon"><CreditCard size={28} /></div>
            <div>
              <h3 className="feature-title">Cashless Payments</h3>
              <p className="feature-desc">
                Pay securely with cards, mobile wallets, or e-payment through our Paymob integration. No cash needed.
              </p>
            </div>
          </div>
          <div className="feature-card glass delay-3 animate-fade-in-up">
            <div className="feature-icon"><Snowflake size={28} /></div>
            <div>
              <h3 className="feature-title">Comfort Guaranteed</h3>
              <p className="feature-desc">
                Air-conditioned vehicles, reserved seats, and a guaranteed boarding experience. No standing, no crowding.
              </p>
            </div>
          </div>
          <div className="feature-card glass delay-4 animate-fade-in-up">
            <div className="feature-icon"><Zap size={28} /></div>
            <div>
              <h3 className="feature-title">Fixed Pricing</h3>
              <p className="feature-desc">
                Transparent, fixed pricing for every route. Know exactly what you'll pay before you book — no surge pricing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <img src={logo} alt="D-Ride" className="footer-logo" />
            <span className="footer-tagline">Operated by Destination</span>
          </div>
          <ul className="footer-links">
            <li><a href="#">About</a></li>
            <li><a href="#">Terms</a></li>
            <li><a href="#">Privacy</a></li>
            <li><a href="#">Contact</a></li>
          </ul>
          <span className="footer-copyright">© 2026 D-Ride. All rights reserved.</span>
        </div>
      </footer>
    </>
  );
}
