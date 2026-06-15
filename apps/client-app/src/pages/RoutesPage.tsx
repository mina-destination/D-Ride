import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { routesAPI, tripsAPI } from '../services/api';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTranslation } from '../context/LanguageContext';
import SEO from '../components/SEO';
import { 
  Map as MapIcon, 
  Clock, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  Navigation, 
  Layers
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// Sub-component for each route card containing its details, map, and timeline
function RouteCard({ 
  route, 
  trips, 
  theme, 
  language, 
  t, 
  onBook 
}: { 
  route: any; 
  trips: any[]; 
  theme: string; 
  language: string; 
  t: any; 
  onBook: (id: string) => void;
}) {
  const [showTimeline, setShowTimeline] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const isAr = language === 'ar';
  
  const startStop = route.checkpoints?.find((c: any) => c.type === 'START') || route.checkpoints?.[0];
  const endStop = route.checkpoints?.find((c: any) => c.type === 'END') || route.checkpoints?.[route.checkpoints?.length - 1];

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const routeCoords: [number, number][] = route.path?.coordinates || [];
    const centerCoords: [number, number] = routeCoords[0] || [31.2357, 30.0444];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: theme === 'dark' ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/bright',
      center: centerCoords,
      zoom: 12,
      attributionControl: false,
      scrollZoom: false,
      boxZoom: false,
      dragPan: false,
      doubleClickZoom: false,
      touchZoomRotate: false,
      dragRotate: false,
      pitchWithRotate: false,
      keyboard: false
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
            'line-width': 6,
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
            'line-width': 3.5,
            'line-opacity': 0.95
          }
        });

        const bounds = routeCoords.reduce(
          (acc, coord) => {
            return [
              [Math.min(acc[0][0], coord[0]), Math.min(acc[0][1], coord[1])],
              [Math.max(acc[1][0], coord[0]), Math.max(acc[1][1], coord[1])]
            ];
          },
          [[routeCoords[0][0], routeCoords[0][1]], [routeCoords[0][0], routeCoords[0][1]]]
        ) as [[number, number], [number, number]];

        map.fitBounds(bounds, { padding: 25, duration: 1000 });
      }

      route.checkpoints?.forEach((cp: any, idx: number) => {
        const latLng: [number, number] = [cp.location.coordinates[0], cp.location.coordinates[1]];
        const isStart = cp.type === 'START';
        const isEnd = cp.type === 'END';

        const el = document.createElement('div');
        const pinSize = isStart || isEnd ? '26px' : '18px';
        el.style.width = pinSize;
        el.style.height = pinSize;

        const pinEl = document.createElement('div');
        if (isStart) {
          pinEl.className = 'google-maps-start-pin';
        } else if (isEnd) {
          pinEl.className = 'google-maps-dest-pin';
        } else {
          pinEl.className = 'google-maps-stop-pin';
          pinEl.innerText = String(idx);
          pinEl.style.fontSize = '9px';
          pinEl.style.lineHeight = '18px';
        }
        el.appendChild(pinEl);

        const popupHtml = `
          <div style="color:var(--text-primary); font-family: Inter, sans-serif; font-size:11px; font-weight:500; padding:4px; min-width:120px;">
            <div style="font-weight:700; color:var(--primary); margin-bottom:2px;">${isStart ? t('departureTerminal') : isEnd ? t('destinationStation') : `${t('waypointStation')} ${idx}`}</div>
            <div style="font-size:10px; opacity:0.9;">${cp.name}</div>
          </div>
        `;
        const popup = new maplibregl.Popup({ offset: 8 }).setHTML(popupHtml);

        new maplibregl.Marker({ element: el, anchor: isStart || isEnd ? 'bottom' : 'center' })
          .setLngLat(latLng)
          .setPopup(popup)
          .addTo(map);
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [route, theme]);

  const minPrice = trips && trips.length > 0
    ? Math.min(...trips.map(t => t.priceEGP))
    : (route.baseFareEGP || 45);

  return (
    <div 
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)',
        transition: 'transform 0.25s ease, box-shadow 0.25s ease',
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}
      className="route-card-hover"
    >
      {/* 1. CARD HEADER */}
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isAr ? 'row-reverse' : 'row' }}>
          <span style={{
            background: 'rgba(59, 130, 246, 0.1)',
            color: '#3B82F6',
            padding: '5px 12px',
            borderRadius: '10px',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.03em'
          }}>
            🚌 {route.routeCode || `LINE ${route.name.split(' ')[0] || ''}`}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: isAr ? 'flex-start' : 'flex-end' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
              {minPrice} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{isAr ? 'ج.م' : 'EGP'}</span>
            </span>
          </div>
        </div>

        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25, textAlign: isAr ? 'right' : 'left' }}>
            {isAr ? route.nameAr || route.name : route.name}
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: isAr ? 'flex-end' : 'flex-start', flexDirection: isAr ? 'row-reverse' : 'row' }}>
            <span>📍</span> <span>{startStop?.name || 'Origin'} ➔ {endStop?.name || 'Destination'}</span>
          </p>
        </div>

        {/* METADATA CHIPS */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem', flexDirection: isAr ? 'row-reverse' : 'row' }}>
          <div style={{ background: 'var(--background)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', flexDirection: isAr ? 'row-reverse' : 'row' }}>
            <Clock size={14} style={{ color: 'var(--primary)' }} />
            <span>{t('routesDurationMins', { count: route.estimatedDurationMinutes || 30 })}</span>
          </div>
          <div style={{ background: 'var(--background)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', flexDirection: isAr ? 'row-reverse' : 'row' }}>
            <span>📏</span>
            <span>{route.distanceKm} km</span>
          </div>
          <div style={{ background: 'var(--background)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', flexDirection: isAr ? 'row-reverse' : 'row' }}>
            <span>🗓️</span>
            <span>{trips && trips.length > 0 ? t('routesTripsScheduled', { count: trips.length }) : t('routesNoTripsScheduled')}</span>
          </div>
        </div>
      </div>

      {/* 2. MAP CONTROLLER CONTAINER */}
      <div style={{ height: '220px', width: '100%', position: 'relative', background: 'var(--background)' }}>
        <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
        {/* Floating marker counts badge */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: isAr ? 'auto' : '12px',
          right: isAr ? '12px' : 'auto',
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(4px)',
          color: '#fff',
          padding: '4px 10px',
          borderRadius: '20px',
          fontSize: '0.75rem',
          fontWeight: 600,
          zIndex: 5,
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexDirection: isAr ? 'row-reverse' : 'row'
        }}>
          <Layers size={12} style={{ color: 'var(--primary)' }} />
          <span>{route.checkpoints?.length || 0} {isAr ? 'محطات' : 'Stations'}</span>
        </div>
      </div>

      {/* 3. COLLAPSIBLE TIMELINE / CHECKPOINTS */}
      <div style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => setShowTimeline(!showTimeline)}
          style={{
            width: '100%',
            padding: '1rem 1.5rem',
            background: 'none',
            border: 'none',
            outline: 'none',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.9rem',
            fontWeight: 700,
            color: 'var(--text-secondary)',
            transition: 'background 0.2s',
            flexDirection: isAr ? 'row-reverse' : 'row'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--background)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexDirection: isAr ? 'row-reverse' : 'row' }}>
            <Navigation size={16} style={{ color: 'var(--primary)' }} />
            {isAr ? 'عرض تفاصيل المحطات ومخطط الخط' : 'Show Stop Details & Timeline'}
          </span>
          {showTimeline ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showTimeline && (
          <div style={{
            padding: '1.5rem',
            background: 'var(--background)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }}>
            {/* Timeline Connecting Line */}
            <div style={{
              position: 'absolute',
              top: '2.25rem',
              bottom: '2.25rem',
              left: isAr ? 'auto' : '2.5rem',
              right: isAr ? '2.5rem' : 'auto',
              width: '2px',
              background: 'repeating-linear-gradient(to bottom, var(--border) 0px, var(--border) 4px, transparent 4px, transparent 8px)'
            }} />

            {route.checkpoints?.map((cp: any, idx: number) => {
              const isStart = cp.type === 'START';
              const isEnd = cp.type === 'END';
              
              return (
                <div 
                  key={`timeline-cp-${route._id}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    marginBottom: idx === (route.checkpoints?.length - 1) ? 0 : '1.5rem',
                    position: 'relative',
                    zIndex: 1,
                    flexDirection: isAr ? 'row-reverse' : 'row'
                  }}
                >
                  {/* Bullet indicator */}
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: isStart 
                      ? 'rgba(16, 185, 129, 0.15)' 
                      : isEnd 
                        ? 'rgba(239, 68, 68, 0.15)' 
                        : 'rgba(59, 130, 246, 0.1)',
                    border: `2px solid ${isStart ? '#10B981' : isEnd ? '#EF4444' : '#3B82F6'}`,
                    color: isStart ? '#10B981' : isEnd ? '#EF4444' : '#3B82F6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0
                  }}>
                    {isStart ? 'S' : isEnd ? 'E' : String(idx)}
                  </div>

                  {/* Text info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexGrow: 1, textAlign: isAr ? 'right' : 'left' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {isAr ? cp.nameAr || cp.name : cp.name}
                    </span>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', justifyContent: isAr ? 'flex-end' : 'flex-start', flexDirection: isAr ? 'row-reverse' : 'row' }}>
                      <span>⏱️ {cp.bufferTimeMinutes} {t('routesBufferMins')}</span>
                      <span>•</span>
                      <span>🌐 Radius: {cp.geofenceRadiusMeters}m</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. BOOKING ACTION BUTTON FOOTER */}
      <div style={{ padding: '1.25rem 1.5rem', background: 'var(--surface-hover)', display: 'flex', justifyContent: isAr ? 'flex-start' : 'flex-end', marginTop: 'auto' }}>
        <button 
          onClick={() => onBook(route._id)}
          style={{
            background: 'var(--primary)',
            border: 'none',
            color: '#000',
            fontWeight: 700,
            padding: '10px 20px',
            borderRadius: '12px',
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'transform 0.2s ease, opacity 0.2s ease',
            boxShadow: '0 4px 15px rgba(245, 183, 49, 0.15)',
            flexDirection: isAr ? 'row-reverse' : 'row'
          }}
          className="button-hover-scale"
          onMouseEnter={e => {
            e.currentTarget.style.opacity = '0.9';
            e.currentTarget.style.transform = 'scale(1.02)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'none';
          }}
        >
          {t('routesBookRideBtn')} 
          <ChevronRight size={16} style={{ transform: isAr ? 'rotate(180deg)' : 'none' }} />
        </button>
      </div>
    </div>
  );
}

export default function RoutesPage() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [tripsMap, setTripsMap] = useState<Record<string, any[]>>({});
  const { t, language } = useTranslation();
  const { theme } = useTheme();

  useEffect(() => {
    routesAPI.getAll()
      .then(async (data) => {
        setRoutes(data);
        
        try {
          const tripPromises = data.map((route: any) =>
            tripsAPI.search(route._id)
              .then((trips: any[]) => ({ routeId: route._id, trips }))
              .catch(() => ({ routeId: route._id, trips: [] }))
          );
          const resolved = await Promise.all(tripPromises);
          const mapMapping: Record<string, any[]> = {};
          resolved.forEach((item) => {
            mapMapping[item.routeId] = item.trips;
          });
          setTripsMap(mapMapping);
        } catch (err) {
          console.error('Error fetching trips for routes:', err);
        }
      })
      .catch(err => console.error('Error fetching routes:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleBook = (routeId: string) => {
    navigate(`/search?routeId=${routeId}`);
  };

  const seoTitle = language === 'ar' ? 'مستكشف مسارات النقل في مصر | دي-رايد' : 'Egypt Transit Routes Explorer | D-Ride';
  const seoDescription = language === 'ar'
    ? 'تصفح مسارات وخطوط الحافلات الثابتة بين القاهرة، الإسكندرية، شرم الشيخ، دهب، نويبع وطابا مع جداول المواعيد والانتظار.'
    : 'Explore fixed transit networks connecting Cairo, Alexandria, Sharm El Sheikh, Dahab, Nuweiba, and Taba with schedules and wait buffers.';

  return (
    <div className="routes-explorer-container" style={{ minHeight: 'calc(100vh - 72px)', background: 'var(--background)', color: 'var(--text-primary)', fontFamily: 'var(--font-family)' }}>
      <SEO title={seoTitle} description={seoDescription} keywords="egypt routes, bus routes, cairo to sharm, alex to dahab, nuweiba, taba" />
      
      {/* HEADER SECTION */}
      <div style={{
        background: 'linear-gradient(135deg, #1A1A2E 0%, #0F0F1A 100%)',
        padding: '8.5rem 2rem 3.5rem',
        borderBottom: '1px solid var(--border)',
        position: 'relative',
        overflow: 'clip',
        textAlign: 'center'
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05, backgroundImage: 'radial-gradient(#F5B731 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        
        <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <span style={{
            background: 'rgba(245, 183, 49, 0.15)',
            color: 'var(--primary)',
            padding: '6px 16px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            border: '1px solid rgba(245, 183, 49, 0.25)',
            display: 'inline-block',
            marginBottom: '1rem'
          }}>
            {t('routesCommuteNetworks')}
          </span>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
            {t('routesExplorerTitle')}
          </h1>
          <p style={{ fontSize: '1rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
            {t('routesExplorerDesc')}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '1rem' }}>
          <div className="app-loading-spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(245, 183, 49, 0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{t('routesLoading')}</span>
        </div>
      ) : routes.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', textAlign: 'center' }}>
          <MapIcon size={64} style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem' }}>{t('routesNoRegisteredTitle')}</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: 0 }}>
            {t('routesNoRegisteredDesc')}
          </p>
        </div>
      ) : (
        <>
          <style>{`
            .routes-unified-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
              gap: 2.5rem;
              padding: 4rem 2rem;
              max-width: 1320px;
              margin: 0 auto;
            }
            @media (max-width: 968px) {
              .routes-unified-grid {
                grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
                gap: 2rem;
                padding: 3rem 1.5rem;
              }
            }
            @media (max-width: 480px) {
              .routes-unified-grid {
                grid-template-columns: 1fr;
                gap: 1.5rem;
                padding: 2rem 1rem;
              }
            }
            .route-card-hover:hover {
              transform: translateY(-6px);
              box-shadow: 0 16px 36px rgba(0, 0, 0, 0.12) !important;
              border-color: var(--primary) !important;
            }
          `}</style>
          <div className="routes-unified-grid">
            {routes.map(route => (
              <RouteCard 
                key={route._id}
                route={route}
                trips={tripsMap[route._id] || []}
                theme={theme}
                language={language}
                t={t}
                onBook={handleBook}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
