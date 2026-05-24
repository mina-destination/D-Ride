import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { routesAPI } from '../services/api';
import logo from '../assets/d-ride-logo.jpeg';
import { Map, MapPin, Search, Ticket, Bus, CreditCard, Snowflake, Zap, Calendar, Users, ArrowUpDown } from 'lucide-react';

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
  const { t, isRtl } = useTranslation();
  const [routes, setRoutes] = useState<any[]>([]);
  const [fromCity, setFromCity] = useState<string>('');
  const [fromStation, setFromStation] = useState<any>(null);
  const [toCity, setToCity] = useState<string>('');
  const [toStation, setToStation] = useState<any>(null);
  const [travelDate, setTravelDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [passengers, setPassengers] = useState<number>(1);
  const navigate = useNavigate();

  // Load all routes to extract cities and stations
  useEffect(() => {
    routesAPI.getAll().then((data) => setRoutes(data)).catch(console.error);
  }, []);

  // Parse cities and stations from routes list
  const parsedData = useMemo(() => {
    const fromCitiesSet = new Set<string>();
    const toCitiesSet = new Set<string>();
    const fromStationsMap: Record<string, any[]> = {};
    const toStationsMap: Record<string, any[]> = {};

    routes.forEach((route) => {
      const parts = route.name.split(/\s+to\s+/i);
      if (parts.length < 2) return;
      const fromC = parts[0].trim();
      const toC = parts[1].trim();

      const fCity = fromC.charAt(0).toUpperCase() + fromC.slice(1);
      const tCity = toC.charAt(0).toUpperCase() + toC.slice(1);

      fromCitiesSet.add(fCity);
      toCitiesSet.add(tCity);

      if (!fromStationsMap[fCity]) fromStationsMap[fCity] = [];
      if (!toStationsMap[tCity]) toStationsMap[tCity] = [];

      const checkpoints = route.checkpoints || [];
      if (checkpoints.length >= 2) {
        const mid = Math.ceil(checkpoints.length / 2);
        checkpoints.forEach((cp: any, idx: number) => {
          const coords = cp.location?.coordinates;
          if (!coords) return;
          const station = {
            name: cp.name,
            nameAr: cp.nameAr,
            lat: coords[1],
            lng: coords[0],
            routeId: route._id || route.id,
          };
          if (idx < mid) {
            if (!fromStationsMap[fCity].some((s) => s.name === station.name)) {
              fromStationsMap[fCity].push(station);
            }
          } else {
            if (!toStationsMap[tCity].some((s) => s.name === station.name)) {
              toStationsMap[tCity].push(station);
            }
          }
        });
      } else {
        const coords = route.path?.coordinates || [];
        if (coords.length >= 2) {
          const startCoords = coords[0];
          const endCoords = coords[coords.length - 1];

          const startStation = {
            name: `${fCity} Start Point`,
            lat: startCoords[1],
            lng: startCoords[0],
            routeId: route._id || route.id,
          };
          const endStation = {
            name: `${tCity} End Point`,
            lat: endCoords[1],
            lng: endCoords[0],
            routeId: route._id || route.id,
          };

          if (!fromStationsMap[fCity].some((s) => s.name === startStation.name)) {
            fromStationsMap[fCity].push(startStation);
          }
          if (!toStationsMap[tCity].some((s) => s.name === endStation.name)) {
            toStationsMap[tCity].push(endStation);
          }
        }
      }
    });

    return {
      fromCities: Array.from(fromCitiesSet),
      toCities: Array.from(toCitiesSet),
      fromStationsMap,
      toStationsMap,
    };
  }, [routes]);

  const availableFromStations = fromCity ? (parsedData.fromStationsMap[fromCity] || []) : [];
  const availableToStations = toCity ? (parsedData.toStationsMap[toCity] || []) : [];

  const handleFromCityChange = (city: string) => {
    setFromCity(city);
    const stations = parsedData.fromStationsMap[city] || [];
    if (stations.length > 0) {
      setFromStation(stations[0]);
    } else {
      setFromStation(null);
    }
  };

  const handleToCityChange = (city: string) => {
    setToCity(city);
    const stations = parsedData.toStationsMap[city] || [];
    if (stations.length > 0) {
      setToStation(stations[0]);
    } else {
      setToStation(null);
    }
  };

  const handleFromStationChange = (stationName: string) => {
    const station = availableFromStations.find((s) => s.name === stationName);
    setFromStation(station || null);
  };

  const handleToStationChange = (stationName: string) => {
    const station = availableToStations.find((s) => s.name === stationName);
    setToStation(station || null);
  };

  const handleSwap = () => {
    const tempCity = fromCity;
    const tempStation = fromStation;
    setFromCity(toCity);
    setFromStation(toStation);
    setToCity(tempCity);
    setToStation(tempStation);
  };

  const canSearch = fromCity && fromStation && toCity && toStation;

  const handleSearch = () => {
    if (canSearch) {
      const pickupLat = fromStation.lat;
      const pickupLng = fromStation.lng;
      const dropoffLat = toStation.lat;
      const dropoffLng = toStation.lng;
      
      navigate(
        `/search?pickupLat=${pickupLat}&pickupLng=${pickupLng}&dropoffLat=${dropoffLat}&dropoffLng=${dropoffLng}&date=${travelDate}&passengers=${passengers}`
      );
    }
  };

  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        
        // Flatten all stations
        const allFromStations: any[] = [];
        Object.entries(parsedData.fromStationsMap).forEach(([city, stations]) => {
          stations.forEach((station: any) => {
            allFromStations.push({ ...station, city });
          });
        });

        if (allFromStations.length === 0) {
          alert("No stations are defined in the platform currently.");
          return;
        }

        // Find nearest
        let nearestStation = allFromStations[0];
        let minDistance = getDistanceKm(latitude, longitude, nearestStation.lat, nearestStation.lng);

        for (let i = 1; i < allFromStations.length; i++) {
          const dist = getDistanceKm(latitude, longitude, allFromStations[i].lat, allFromStations[i].lng);
          if (dist < minDistance) {
            minDistance = dist;
            nearestStation = allFromStations[i];
          }
        }

        // Set state
        setFromCity(nearestStation.city);
        setFromStation(nearestStation);
        
        const matchedMsg = isRtl
          ? `تم العثور على أقرب محطة: ${nearestStation.name} في ${nearestStation.city} (على بعد ${minDistance.toFixed(2)} كم)`
          : `Matched nearest station: ${nearestStation.name} in ${nearestStation.city} (${minDistance.toFixed(2)} km away)`;
        alert(matchedMsg);
      },
      (error) => {
        alert("Failed to retrieve location: " + error.message);
      }
    );
  };

  const polylinePath: [number, number][] = [];
  if (fromStation) polylinePath.push([fromStation.lat, fromStation.lng]);
  if (toStation) polylinePath.push([toStation.lat, toStation.lng]);

  return (
    <>
      <div className="from-to-container">
        {/* DETECT LOCATION ACTION */}
        <button
          type="button"
          onClick={handleDetectLocation}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '10px 14px',
            background: 'rgba(245, 183, 49, 0.1)',
            border: '1px dashed var(--primary)',
            borderRadius: '8px',
            color: 'var(--primary)',
            fontSize: '0.82rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginBottom: '1rem',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(245, 183, 49, 0.18)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(245, 183, 49, 0.1)';
          }}
        >
          <MapPin size={14} /> {isRtl ? 'تحديد أقرب محطة' : 'Detect Nearest Station'}
        </button>

        {/* ROW 1: FROM */}
        <div className="from-to-row">
          <div className="from-to-field">
            <label className="field-label">From City</label>
            <div className="field-select-wrapper">
              <MapPin size={16} className="field-icon-left" />
              <select
                value={fromCity}
                onChange={(e) => handleFromCityChange(e.target.value)}
                className="field-select"
              >
                <option value="">Select City</option>
                {parsedData.fromCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="from-to-field">
            <label className="field-label">From Station</label>
            <div className="field-select-wrapper">
              <Map size={16} className="field-icon-left" />
              <select
                value={fromStation ? fromStation.name : ''}
                onChange={(e) => handleFromStationChange(e.target.value)}
                className="field-select"
                disabled={!fromCity}
              >
                <option value="">Select Station</option>
                {availableFromStations.map((station) => (
                  <option key={station.name} value={station.name}>
                    {station.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* SWAP BUTTON */}
        <div className="swap-button-container">
          <button type="button" className="swap-button" onClick={handleSwap}>
            <ArrowUpDown size={16} />
          </button>
        </div>

        {/* ROW 2: TO */}
        <div className="from-to-row">
          <div className="from-to-field">
            <label className="field-label">To City</label>
            <div className="field-select-wrapper">
              <MapPin size={16} className="field-icon-left" style={{ color: '#EF4444' }} />
              <select
                value={toCity}
                onChange={(e) => handleToCityChange(e.target.value)}
                className="field-select"
              >
                <option value="">Select City</option>
                {parsedData.toCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="from-to-field">
            <label className="field-label">To Station</label>
            <div className="field-select-wrapper">
              <Map size={16} className="field-icon-left" style={{ color: '#EF4444' }} />
              <select
                value={toStation ? toStation.name : ''}
                onChange={(e) => handleToStationChange(e.target.value)}
                className="field-select"
                disabled={!toCity}
              >
                <option value="">Select Station</option>
                {availableToStations.map((station) => (
                  <option key={station.name} value={station.name}>
                    {station.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ROW 3: DATE */}
        <div className="from-to-row">
          <div className="from-to-field full-width">
            <label className="field-label">Travel Date</label>
            <div className="field-select-wrapper">
              <Calendar size={16} className="field-icon-left" />
              <input
                type="date"
                value={travelDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setTravelDate(e.target.value)}
                className="field-input"
              />
            </div>
          </div>
        </div>

        {/* ROW 4: PASSENGERS */}
        <div className="from-to-row">
          <div className="from-to-field full-width">
            <label className="field-label">Number of Seats</label>
            <div className="passenger-selector">
              <Users size={16} className="field-icon-left" style={{ color: 'var(--primary)', position: 'static' }} />
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  flex: 1,
                  textAlign: 'left',
                  marginLeft: '8px',
                }}
              >
                {passengers} {passengers === 1 ? 'Seat' : 'Seats'}
              </span>
              <div className="passenger-controls">
                <button
                  type="button"
                  onClick={() => setPassengers((p) => Math.max(1, p - 1))}
                  className="passenger-control-btn"
                  disabled={passengers <= 1}
                >
                  -
                </button>
                <span className="passenger-count">{passengers}</span>
                <button
                  type="button"
                  onClick={() => setPassengers((p) => Math.min(10, p + 1))}
                  className="passenger-control-btn"
                  disabled={passengers >= 10}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mini map preview when both pins are set */}
      {fromStation && toStation && (
        <div
          style={{
            height: '180px',
            borderRadius: '12px',
            overflow: 'hidden',
            margin: '1rem 0',
            border: '1px solid var(--border)',
            zIndex: 1,
          }}
        >
          <MapContainer
            center={[(fromStation.lat + toStation.lat) / 2, (fromStation.lng + toStation.lng) / 2]}
            zoom={11}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[fromStation.lat, fromStation.lng]}>
              <Popup>📍 Pickup: {fromStation.name}</Popup>
            </Marker>
            <Marker position={[toStation.lat, toStation.lng]}>
              <Popup>🏁 Dropoff: {toStation.name}</Popup>
            </Marker>
            <Polyline
              positions={[
                [fromStation.lat, fromStation.lng],
                [toStation.lat, toStation.lng],
              ]}
              color="var(--primary)"
              weight={3}
              dashArray="8 6"
              opacity={0.6}
            />
            <RouteMapAutopan
              path={[
                [fromStation.lat, fromStation.lng],
                [toStation.lat, toStation.lng],
              ]}
            />
          </MapContainer>
        </div>
      )}

      <button
        className="search-btn"
        onClick={handleSearch}
        disabled={!canSearch}
        id="search-trips-btn"
        style={{ marginTop: '0.5rem' }}
      >
        Show Trips <Search size={18} />
      </button>

      {/* Fallback to manual route selection */}
      <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
        <Link
          to="/routes"
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          Or browse all routes manually →
        </Link>
      </div>
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
