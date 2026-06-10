import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { socketService } from '../services/socket';
import api from '../services/api';
import { useTranslation } from '../context/LanguageContext';
import SEO from '../components/SEO';
import { Compass, Search, AlertCircle, Phone } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from '../context/ThemeContext';

export default function FamilyTrackingPage() {
  const { t, isRtl, language } = useTranslation();
  const { theme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  const isAr = language === 'ar';
  const seoTitle = isAr ? 'تتبع رحلة عائلتك مباشرة | دي-رايد' : 'Track Family Ride Live | D-Ride';
  const seoDescription = isAr
    ? 'تتبع حافلة أحد أفراد عائلتك مباشرة على الخريطة التفاعلية مع تحديثات الموقع الجغرافي الفورية.'
    : 'Track your family member\'s D-Ride commuter minibus live on the interactive map with real-time GPS telemetry.';

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const busMarkerRef = useRef<maplibregl.Marker | null>(null);

  // States
  const [inputCode, setInputCode] = useState('');
  const [code, setCode] = useState<string | null>(searchParams.get('code'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<any>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [arrivedCheckpoints, setArrivedCheckpoints] = useState<string[]>([]);

  // Parse code from search query on mount or query change
  useEffect(() => {
    const qCode = searchParams.get('code');
    if (qCode) {
      setCode(qCode);
    }
  }, [searchParams]);

  // Fetch booking details by code
  useEffect(() => {
    if (!code) {
      setBooking(null);
      setLocation(null);
      return;
    }

    const fetchTrackingData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res: any = await api.get(`/bookings/track-by-code/${code}`);
        setBooking(res.booking);
        if (res.liveLocation && res.liveLocation.location?.coordinates) {
          setLocation({
            lat: res.liveLocation.location.coordinates[1],
            lng: res.liveLocation.location.coordinates[0],
          });
        }
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.message || err.message || 'Failed to load family tracking data.');
        setBooking(null);
        setLocation(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTrackingData();
  }, [code]);

  // Initialize map and route line once booking details are fetched
  useEffect(() => {
    if (!mapContainerRef.current || !booking?.tripId?.routeId) return;

    const routeCoords: [number, number][] = booking.tripId.routeId.path?.coordinates || [];
    const centerCoords: [number, number] = location ? [location.lng, location.lat] : (routeCoords[0] || [31.2357, 30.0444]);

    if (maplibregl.getRTLTextPluginStatus() === 'unavailable') {
      maplibregl.setRTLTextPlugin(
        window.location.origin + '/mapbox-gl-rtl-text.js',
        true
      );
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: theme === 'dark' ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/bright',
      center: centerCoords,
      zoom: 14,
      attributionControl: false
    });

    map.on('styledata', () => {
      const style = map.getStyle();
      if (style && style.layers) {
        style.layers.forEach((layer) => {
          if (
            layer.type === 'symbol' &&
            layer.layout &&
            layer.layout['text-field'] &&
            (layer.id.includes('name') || layer.id.includes('label') || layer.id.includes('place')) &&
            !layer.id.includes('shield') &&
            !layer.id.includes('housenumber')
          ) {
            map.setLayoutProperty(layer.id, 'text-field', [
              'coalesce',
              ['get', 'name:ar'],
              ['get', 'name']
            ]);
          }
        });
      }
    });

    map.on('styleimagemissing', (e) => {
      const width = 16;
      const height = 16;
      const data = new Uint8Array(width * height * 4);
      if (!map.hasImage(e.id)) {
        map.addImage(e.id, { width, height, data });
      }
    });

    mapRef.current = map;

    map.on('load', () => {
      // Draw route polyline
      if (routeCoords.length > 0) {
        map.addSource('route-path', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: routeCoords
            }
          }
        });

        map.addLayer({
          id: 'route-line-casing',
          type: 'line',
          source: 'route-path',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': theme === 'dark' ? '#174ea6' : '#ffffff',
            'line-width': 8,
            'line-opacity': 0.9
          }
        });

        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route-path',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': theme === 'dark' ? '#8ab4f8' : '#1a73e8',
            'line-width': 5,
            'line-opacity': 0.95
          }
        });

        // Add static markers for start and end terminals
        const startEl = document.createElement('div');
        startEl.style.width = '32px';
        startEl.style.height = '32px';
        const startPin = document.createElement('div');
        startPin.className = 'google-maps-start-pin';
        startEl.appendChild(startPin);

        const startPopup = new maplibregl.Popup({ offset: 15 }).setHTML(`<div style="color:#000; font-size:11px; font-weight:bold; padding:2px;">🏁 ${t('departureTerminal')}</div>`);
        new maplibregl.Marker({ element: startEl, anchor: 'bottom' })
          .setLngLat(routeCoords[0])
          .setPopup(startPopup)
          .addTo(map);

        const endEl = document.createElement('div');
        endEl.style.width = '32px';
        endEl.style.height = '32px';
        const endPin = document.createElement('div');
        endPin.className = 'google-maps-dest-pin';
        endEl.appendChild(endPin);

        const endPopup = new maplibregl.Popup({ offset: 15 }).setHTML(`<div style="color:#000; font-size:11px; font-weight:bold; padding:2px;">🏁 ${t('destinationStation')}</div>`);
        new maplibregl.Marker({ element: endEl, anchor: 'bottom' })
          .setLngLat(routeCoords[routeCoords.length - 1])
          .setPopup(endPopup)
          .addTo(map);

        // Fit bounds
        const bounds = routeCoords.reduce(
          (acc, coord) => [
            [Math.min(acc[0][0], coord[0]), Math.min(acc[0][1], coord[1])],
            [Math.max(acc[1][0], coord[0]), Math.max(acc[1][1], coord[1])]
          ],
          [[routeCoords[0][0], routeCoords[0][1]], [routeCoords[0][0], routeCoords[0][1]]]
        ) as [[number, number], [number, number]];

        map.fitBounds(bounds, { padding: 50, duration: 1000 });
      }
    });

    return () => {
      map.remove();
      busMarkerRef.current = null;
      mapRef.current = null;
    };
  }, [booking, theme]);

  // Update bus marker and center map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !location) return;

    const busCoords: [number, number] = [location.lng, location.lat];

    if (!busMarkerRef.current) {
      const el = document.createElement('div');
      el.style.width = '38px';
      el.style.height = '38px';

      const busEl = document.createElement('div');
      busEl.className = 'google-maps-bus-pointer';
      el.appendChild(busEl);

      const busPopup = new maplibregl.Popup({ offset: 15 }).setHTML(`
        <div style="color:#000; font-family: Inter, sans-serif; font-size:11px; padding:4px;">
          <h4 style="margin: 0 0 4px 0; color: #f5b731;">${t('shuttleActiveLocation')}</h4>
          <span>Lat: ${location.lat.toFixed(5)}, Lng: ${location.lng.toFixed(5)}</span>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(busCoords)
        .setPopup(busPopup)
        .addTo(map);

      busMarkerRef.current = marker;
    } else {
      busMarkerRef.current.setLngLat(busCoords);
    }

    map.flyTo({ center: busCoords, zoom: map.getZoom(), animate: true });
  }, [location]);

  // WebSocket connection & telemetry room subscription
  useEffect(() => {
    if (!booking?.tripId?.vehicleId?._id || !code) return;

    const vehicleId = booking.tripId.vehicleId._id;

    socketService.connect();
    socketService.subscribeToVehicle(vehicleId, code);

    const handleLocationUpdate = (data: any) => {
      if (data.vehicleId === vehicleId && data.location) {
        setLocation({ lat: data.location.latitude, lng: data.location.longitude });
      }
    };

    const handleCheckpointUpdate = (data: any) => {
      if (data.vehicleId === vehicleId && data.arrivedCheckpoints) {
        setArrivedCheckpoints(data.arrivedCheckpoints);
      }
    };

    socketService.onVehicleLocationUpdate(handleLocationUpdate);
    socketService.onCheckpointUpdate(handleCheckpointUpdate);

    return () => {
      socketService.unsubscribeFromVehicle(vehicleId);
      socketService.offVehicleLocationUpdate(handleLocationUpdate);
      socketService.offCheckpointUpdate(handleCheckpointUpdate);
      socketService.disconnect();
    };
  }, [booking?.tripId?.vehicleId?._id, code]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    setSearchParams({ code: inputCode.trim() });
    setCode(inputCode.trim());
  };

  // 1. Initial State: Code Entry Screen
  if (!code) {
    return (
      <div className="auth-page" style={{ padding: '80px 24px' }}>
        <SEO title={seoTitle} description={seoDescription} />
        <div className="auth-card glass" style={{ maxWidth: '460px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'rgba(245, 183, 49, 0.1)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem auto',
            border: '1.5px solid var(--primary)',
            boxShadow: '0 0 15px rgba(245, 183, 49, 0.2)'
          }}>
            <Compass size={28} style={{ color: 'var(--primary)' }} />
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {isAr ? 'تتبع رحلة عائلتك' : 'Track Family Ride'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            {isAr 
              ? 'أدخل رمز تذكرة (UUID) أحد أفراد عائلتك لتتبع موقع حافلتهم الجغرافي بشكل مباشر وفي الوقت الفعلي.' 
              : 'Enter your family member\'s shared ticket ID (UUID) to follow their shuttle bus location on the map in real-time.'}
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={inputCode}
                onChange={e => setInputCode(e.target.value)}
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                className="input-field"
                style={{ paddingRight: '40px' }}
                required
              />
              <Search size={18} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
            <button type="submit" className="auth-button" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {isAr ? 'ابدأ التتبع المباشر 📡' : 'Start Live Tracking 📡'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Loading State
  if (loading) {
    return (
      <div className="auth-page">
        <SEO title={seoTitle} description={seoDescription} />
        <div style={{ textAlign: 'center', padding: '100px 24px', color: 'var(--text-muted)' }}>
          <div className="app-loading-spinner" style={{ margin: '0 auto 1.5rem auto' }} />
          <span>{isAr ? 'جاري تحميل تفاصيل التذكرة...' : 'Loading ticket details...'}</span>
        </div>
      </div>
    );
  }

  // 3. Error State
  if (error) {
    return (
      <div className="auth-page" style={{ padding: '80px 24px' }}>
        <SEO title={seoTitle} description={seoDescription} />
        <div className="auth-card glass" style={{ maxWidth: '460px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem auto',
            border: '1.5px solid var(--danger)',
            boxShadow: '0 0 15px rgba(239, 68, 68, 0.2)'
          }}>
            <AlertCircle size={28} style={{ color: 'var(--danger)' }} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {isAr ? 'عذراً، فشل التحميل' : 'Tracking Failed'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            {error}
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => { setCode(null); setSearchParams({}); }} className="auth-button" style={{ flex: 1, background: 'var(--surface-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
              {isAr ? 'محاولة رمز آخر' : 'Try Another Code'}
            </button>
            <Link to="/" className="auth-button" style={{ flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isAr ? 'العودة للرئيسية' : 'Back Home'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4. Live Map Telemetry Interface
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <SEO title={seoTitle} description={seoDescription} />
      <div style={{ flex: 1, position: 'relative' }}>
        
        {/* Floating Family Member Details Card */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          width: '320px',
          maxHeight: 'calc(100% - 40px)',
          overflowY: 'auto',
          zIndex: 1000,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: '1.25rem',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          textAlign: 'left'
        }} className="animate-fade-in-up">
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
              {location ? (isAr ? 'بث الموقع نشط 📡' : 'Live Tracking') : (isAr ? 'غير متصل بالبث 🕒' : 'Offline')}
            </span>
            <button 
              onClick={() => { setCode(null); setSearchParams({}); }}
              style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
            >
              {isAr ? 'تغيير الرمز ✕' : 'Change Code ✕'}
            </button>
          </div>

          <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 0 0', lineHeight: 1.3 }}>
            {isRtl ? (booking.tripId?.routeId?.nameAr || booking.tripId?.routeId?.name || 'رحلة حافلة') : (booking.tripId?.routeId?.name || 'Bus Route')}
          </h1>

          <div style={{ background: 'var(--surface-elevated)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <strong>{isAr ? 'الراكب المتابع:' : 'Passenger:'}</strong> {booking.userId?.name || 'Family Member'} <br />
            <strong>{isAr ? 'المقاعد المحجوزة:' : 'Seat(s):'}</strong> #{booking.seatNumbers?.join(', ') || booking.seatNumber || '1'}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />

          {/* Vehicle & Driver Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', margin: '4px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('vehicleModel')}</span>
              <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                {booking.tripId?.vehicleId?.model ? booking.tripId.vehicleId.model.replace('::', ' ') : 'Toyota HiAce'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('licensePlate')}</span>
              <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                {booking.tripId?.vehicleId?.plateNumber || booking.tripId?.vehicleId?.licensePlate || ' ط ر ق ٥٤٣٢'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('driverPartner')}</span>
              <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                {booking.tripId?.driverId?.name || (isAr ? 'كابتن محمد حجازي' : 'Capt. Mohamed Hegazi')}
              </span>
            </div>
          </div>

          {booking.tripId?.driverId?.phone && (
            <div style={{ marginTop: '4px' }}>
              <a 
                href={`tel:${booking.tripId.driverId.phone}`} 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'var(--primary)',
                  color: 'black',
                  fontWeight: 700,
                  fontSize: '11px',
                  textDecoration: 'none',
                  transition: 'var(--transition-base)'
                }}
              >
                <Phone size={14} fill="black" /> {isAr ? 'اتصل بالسائق الشريك' : 'Call Driver Partner'}
              </a>
            </div>
          )}

          {/* Live Checkpoint Progress */}
          {booking.tripId?.routeId?.checkpoints && (
            <div style={{ marginTop: '12px', textAlign: 'left' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                {isAr ? 'مسار الرحلة والوصول:' : 'Route Checkpoints:'}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', padding: '10px', background: 'var(--surface-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                {booking.tripId.routeId.checkpoints
                  .slice()
                  .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                  .map((cp: any, idx: number) => {
                    const isArrived = arrivedCheckpoints.includes(cp.name);
                    return (
                      <div key={cp.name || idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                        <div style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: isArrived ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${isArrived ? 'var(--primary)' : 'rgba(255,255,255,0.2)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '8px',
                          color: isArrived ? 'black' : 'var(--text-muted)',
                          fontWeight: 'bold',
                          flexShrink: 0
                        }}>
                          {isArrived ? '✓' : ''}
                        </div>
                        <span style={{ 
                          color: isArrived ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: isArrived ? 'line-through' : 'none',
                          fontWeight: isArrived ? 500 : 600
                        }}>
                          {isAr ? (cp.nameAr || cp.name) : cp.name}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        <div ref={mapContainerRef} style={{ height: '100%', width: '100%', zIndex: 0 }} />
      </div>
    </div>
  );
}
