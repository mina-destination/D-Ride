import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { socketService } from '../services/socket';
import api from '../services/api';
import { useTranslation } from '../context/LanguageContext';
import SEO from '../components/SEO';

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from '../context/ThemeContext';

export default function LiveTrackingPage() {
  const { t, isRtl, language } = useTranslation();
  const { theme } = useTheme();

  const isAr = language === 'ar';
  const seoTitle = isAr ? 'تتبع الحافلة مباشرة | دي-رايد' : 'Live Shuttle Tracking | D-Ride';
  const seoDescription = isAr
    ? 'تتبع حافلة دي-رايد الخاصة بك مباشرة على الخريطة التفاعلية مع تحديثات الموقع الجغرافي الفورية.'
    : 'Track your D-Ride commuter minibus live on the interactive map with real-time GPS telemetry updates.';
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const busMarkerRef = useRef<maplibregl.Marker | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [searchParams] = useSearchParams();
  const vehicleId = searchParams.get('vehicleId');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [trip, setTrip] = useState<any>(null);
  const [etaInfo, setEtaInfo] = useState<{ nextCheckpoint: string; etaMinutes: number; distanceMeters: number } | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);

  // Load trip details to draw the route path on the map
  useEffect(() => {
    const tripId = searchParams.get('tripId');
    if (!tripId) return;

    api.get(`/trips/${tripId}`)
      .then(data => setTrip(data))
      .catch(console.error);
  }, [searchParams]);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);



  // Initialize map and route line
  useEffect(() => {
    if (!mapContainerRef.current || !trip?.routeId) return;

    const routeCoords: [number, number][] = trip.routeId.path?.coordinates || [];
    const centerCoords: [number, number] = routeCoords[0] || [31.2357, 30.0444];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: theme === 'dark' ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/bright',
      center: centerCoords,
      zoom: 14,
      attributionControl: false
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

    map.on('load', () => {
      // Add static markers for start and end terminals if coordinates exist
      if (routeCoords.length > 0) {
        // Add static markers for start and end terminals using Google Maps pins with wrappers
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
          (acc, coord) => {
            return [
              [Math.min(acc[0][0], coord[0]), Math.min(acc[0][1], coord[1])],
              [Math.max(acc[1][0], coord[0]), Math.max(acc[1][1], coord[1])]
            ];
          },
          [[routeCoords[0][0], routeCoords[0][1]], [routeCoords[0][0], routeCoords[0][1]]]
        ) as [[number, number], [number, number]];

        map.fitBounds(bounds, { padding: 50, duration: 1000 });
      }
    });

    return () => {
      map.remove();
      busMarkerRef.current = null;
    };
  }, [trip, theme]);

  // Update bus marker and center map with smooth location smoothing animation
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !location) return;

    const busCoords: [number, number] = [location.lng, location.lat];

    if (!busMarkerRef.current) {
      // Create custom Google Maps bus marker HTML element with outer wrapper
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
      // Smooth animated interpolation to prevent jumping markers
      const fromCoords = busMarkerRef.current.getLngLat();
      const from = { lat: fromCoords.lat, lng: fromCoords.lng };
      const to = { lat: location.lat, lng: location.lng };

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }

      const duration = 2000; // transition over 2 seconds
      const start = performance.now();

      const animateStep = (now: number) => {
        const timeFraction = Math.min((now - start) / duration, 1);
        // Easing function (easeInOutQuad)
        const t = timeFraction < 0.5 ? 2 * timeFraction * timeFraction : 1 - Math.pow(-2 * timeFraction + 2, 2) / 2;

        const currentLat = from.lat + (to.lat - from.lat) * t;
        const currentLng = from.lng + (to.lng - from.lng) * t;

        if (busMarkerRef.current) {
          busMarkerRef.current.setLngLat([currentLng, currentLat]);
        }

        if (timeFraction < 1) {
          animFrameRef.current = requestAnimationFrame(animateStep);
        }
      };

      animFrameRef.current = requestAnimationFrame(animateStep);
    }

    map.flyTo({ center: busCoords, zoom: map.getZoom(), animate: true });
  }, [location]);



  if (!vehicleId) {
    return (
      <div className="auth-page">
        <SEO title={seoTitle} description={seoDescription} />
        <div className="auth-card glass" style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{t('noVehicleSelected')}</h1>
          <p>{t('selectTripToTrack')}</p>
          <Link to="/my-trips" className="auth-button" style={{ marginTop: '1rem', display: 'inline-block' }}>{t('backToMyTrips')}</Link>
        </div>
      </div>
    );
  }

  // Default center (Cairo) if location is not yet received

  useEffect(() => {
    if (!vehicleId) return;

    socketService.connect();
    socketService.subscribeToVehicle(vehicleId);

    const handleLocationUpdate = (data: any) => {
      if (data.vehicleId === vehicleId && data.location) {
        setLocation({ lat: data.location.latitude, lng: data.location.longitude });
        if (data.location.speed !== undefined) {
          setSpeed(data.location.speed);
        }
      }
    };

    const handleEtaUpdate = (data: any) => {
      if (data.vehicleId === vehicleId) {
        setEtaInfo({
          nextCheckpoint: data.nextCheckpoint,
          etaMinutes: data.etaMinutes,
          distanceMeters: data.distanceMeters,
        });
      }
    };

    socketService.onVehicleLocationUpdate(handleLocationUpdate);
    socketService.onEtaUpdate(handleEtaUpdate);

    return () => {
      socketService.unsubscribeFromVehicle(vehicleId);
      socketService.offVehicleLocationUpdate(handleLocationUpdate);
      socketService.offEtaUpdate(handleEtaUpdate);
      socketService.disconnect();
    };
  }, [vehicleId]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <SEO title={seoTitle} description={seoDescription} />
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
          background: 'var(--surface)',
          border: theme === 'light'
            ? '1px solid rgba(226, 232, 240, 0.7)'
            : '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: '1.25rem',
          boxShadow: theme === 'light'
            ? '0 12px 40px rgba(0, 0, 0, 0.05)'
            : '0 20px 40px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
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
              {location ? t('activeGpsTracking') : t('vehicleOffline')}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>
              {isRtl ? 'الحالة:' : 'STATUS:'} {trip?.status === 'SCHEDULED' ? t('statusScheduled') : (trip?.status || t('statusScheduled'))}
            </span>
          </div>

          <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 0 0', lineHeight: 1.3 }}>
            {isRtl ? (trip?.routeId?.nameAr || trip?.routeId?.name || t('loadingRoute')) : (trip?.routeId?.name || t('loadingRoute'))}
          </h1>

          <div style={{ background: 'var(--surface-elevated)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <strong>{t('scheduledDeparture')}</strong> {trip ? new Date(trip.departureTime).toLocaleString(isRtl ? 'ar-EG' : 'en-US') : t('loadingRoute')}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />

          {/* Fallback Info for Offline State */}
          {!location ? (
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              ℹ️ {t('minibusDetailsWillUpdate')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--success)', fontWeight: 600 }}>
                🟢 {t('minibusOnRoute')}
              </div>

              {etaInfo && (
                <div style={{
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '11px',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div>
                    🏁 {isRtl ? 'المحطة القادمة:' : 'Next Stop:'}{' '}
                    <strong>{etaInfo.nextCheckpoint}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                    <span>⏱️ {isRtl ? 'الوصول المتوقع:' : 'ETA:'}</span>
                    <strong style={{ color: 'var(--primary)', fontSize: '12px' }}>
                      {etaInfo.etaMinutes} {isRtl ? 'دقيقة' : 'min'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>📏 {isRtl ? 'المسافة المتبقية:' : 'Distance:'}</span>
                    <strong style={{ color: 'var(--text-secondary)' }}>
                      {(etaInfo.distanceMeters / 1000).toFixed(1)} km
                    </strong>
                  </div>
                </div>
              )}

              {speed !== null && speed > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>⚡ {isRtl ? 'السرعة الحالية:' : 'Current Speed:'}</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{Math.round(speed)} km/h</span>
                </div>
              )}
            </div>
          )}

          {/* Vehicle & Driver Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', margin: '4px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('vehicleModel')}</span>
              <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                {trip?.vehicleId?.model ? `${trip.vehicleId.make || ''} ${trip.vehicleId.model}`.trim() : 'Toyota HiAce'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('licensePlate')}</span>
              <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                {trip?.vehicleId?.licensePlate || trip?.vehicleId?.plateNumber || (isRtl ? 'ط ر ق ٥٤٣٢' : ' ط ر ق ٥٤٣٢')}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('driverPartner')}</span>
              <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{trip?.driverId?.name || (isRtl ? 'كابتن محمد حجازي' : 'Capt. Mohamed Hegazi')}</span>
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
              📞 {t('callOperator')}
            </a>
            <button
              onClick={() => alert(t('supportTicketCreatedAlert'))}
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
              💬 {t('supportChat')}
            </button>
          </div>
        </div>

        <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />


      </div>
    </div>
  );
}
