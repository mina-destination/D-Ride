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
  Navigation, 
  Layers
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function RoutesPage() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [tripsMap, setTripsMap] = useState<Record<string, any[]>>({});
  const { t, language } = useTranslation();
  const { theme } = useTheme();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    routesAPI.getAll()
      .then(async (data) => {
        setRoutes(data);
        if (data.length > 0) {
          setActiveRouteId(data[0]._id);
        }
        
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

  const activeRoute = routes.find(r => r._id === activeRouteId);

  const handleBook = (routeId: string) => {
    navigate(`/search?routeId=${routeId}`);
  };

  useEffect(() => {
    if (!mapContainerRef.current || !activeRoute) return;

    const routeCoords: [number, number][] = activeRoute.path?.coordinates || [];
    const centerCoords: [number, number] = routeCoords[0] || [31.2357, 30.0444];

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
      zoom: 12,
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
            const isPointLabel =
              layer.id.includes('country') ||
              layer.id.includes('city') ||
              layer.id.includes('town') ||
              layer.id.includes('village');

            if (isPointLabel) {
              // Show Arabic on top, English below
              map.setLayoutProperty(layer.id, 'text-field', [
                'case',
                ['has', 'name:ar'],
                ['concat', ['get', 'name:ar'], '\n', ['coalesce', ['get', 'name:en'], ['get', 'name']]],
                ['get', 'name']
              ]);
            } else {
              // For street names, water bodies, etc., show Arabic if available, fallback to default name
              map.setLayoutProperty(layer.id, 'text-field', [
                'coalesce',
                ['get', 'name:ar'],
                ['get', 'name']
              ]);
            }

            // Customize colors for Dark Mode to make labels stand out premium and readable
            if (theme === 'dark') {
              if (isPointLabel) {
                map.setPaintProperty(layer.id, 'text-color', '#F5B731'); // Gold/Yellow matching D-Ride theme
              } else {
                map.setPaintProperty(layer.id, 'text-color', '#FFFFFF'); // Clean white for streets and features
              }
              map.setPaintProperty(layer.id, 'text-halo-color', '#1A1A1A'); // Near-black halo/glow for maximum legibility
              map.setPaintProperty(layer.id, 'text-halo-width', 1.5);
            } else {
              // Reset/preserve default light theme colors
              if (isPointLabel) {
                map.setPaintProperty(layer.id, 'text-color', '#2d3748'); // Dark slate
              } else {
                map.setPaintProperty(layer.id, 'text-color', '#4a5568'); // Gray
              }
              map.setPaintProperty(layer.id, 'text-halo-color', '#ffffff'); // White halo
              map.setPaintProperty(layer.id, 'text-halo-width', 1.5);
            }
          }
        });
      }
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
      // Snapped roadway polyline path
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

        map.fitBounds(bounds, { padding: 40, duration: 1000 });
      }

      // Checkpoints
      activeRoute.checkpoints?.forEach((cp: any, idx: number) => {
        const latLng: [number, number] = [cp.location.coordinates[0], cp.location.coordinates[1]];
        const isStart = cp.type === 'START';
        const isEnd = cp.type === 'END';

        const el = document.createElement('div');
        const pinSize = isStart || isEnd ? '32px' : '22px';
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
        }
        el.appendChild(pinEl);

        const popupHtml = `
          <div style="color:var(--text-primary); font-family: Inter, sans-serif; font-size:12px; font-weight:500; padding:6px; min-width:140px;">
            <div style="font-weight:700; color:var(--primary); margin-bottom:2px;">${isStart ? t('departureTerminal') : isEnd ? t('destinationStation') : `${t('waypointStation')} ${idx}`}</div>
            <div style="font-size:11px; opacity:0.9;">${cp.name}</div>
          </div>
        `;
        const popup = new maplibregl.Popup({ offset: 10 }).setHTML(popupHtml);

        new maplibregl.Marker({ element: el, anchor: isStart || isEnd ? 'bottom' : 'center' })
          .setLngLat(latLng)
          .setPopup(popup)
          .addTo(map);
      });
    });

    return () => {
      map.remove();
    };
  }, [activeRoute, theme, loading]);

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
        <div className="routes-explorer-grid">
          
          {/* LEFT COLUMN: ROUTE CARDS LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('routesAvailableLines', { count: routes.length })}
            </h3>
            
            {routes.map(route => {
              const isActive = route._id === activeRouteId;
              const startStop = route.checkpoints?.find((c: any) => c.type === 'START') || route.checkpoints?.[0];
              const endStop = route.checkpoints?.find((c: any) => c.type === 'END') || route.checkpoints?.[route.checkpoints?.length - 1];

              return (
                <div 
                  key={route._id}
                  onClick={() => setActiveRouteId(route._id)}
                  style={{
                    background: isActive ? 'var(--surface-elevated)' : 'var(--surface)',
                    border: isActive ? '2px solid var(--primary)' : '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    cursor: 'pointer',
                    boxShadow: isActive ? '0 4px 20px rgba(245, 183, 49, 0.08)' : 'none',
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: '#3B82F6',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em'
                      }}>
                        🚌 {route.routeCode || `LINE ${route.name.split(' ')[0] || ''}`}
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                        {language === 'ar' ? 'ج.م' : 'EGP'} {tripsMap[route._id] && tripsMap[route._id].length > 0
                          ? Math.min(...tripsMap[route._id].map(t => t.priceEGP))
                          : (route.baseFareEGP || 45)
                        }
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {language === 'ar' ? route.nameAr || route.name : route.name}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        📍 {startStop?.name || 'Origin'} ➔ {endStop?.name || 'Destination'}
                      </p>
                    </div>

                    <div 
                      style={{
                        background: 'var(--background)',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: '1px solid var(--border)',
                        transition: 'border-color 0.2s'
                      }}
                      onMouseEnter={e => {
                        if (tripsMap[route._id] && tripsMap[route._id].length > 0) {
                          e.currentTarget.style.borderColor = 'var(--primary)';
                        }
                      }}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ⏰ {tripsMap[route._id] && tripsMap[route._id].length > 0 ? (
                          <span>{t('routesTripsScheduled', { count: tripsMap[route._id].length })}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>{t('routesNoTripsScheduled')}</span>
                        )}
                      </span>
                      {tripsMap[route._id] && tripsMap[route._id].length > 0 && (
                        <span style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700 }}>{t('routesBookShuttles')}</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={14} /> {t('routesDurationMins', { count: route.estimatedDurationMinutes || 30 })}
                      </span>
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBook(route._id);
                        }}
                        style={{
                          background: 'var(--primary)',
                          border: 'none',
                          color: '#000',
                          fontWeight: 700,
                          padding: '6px 14px',
                          borderRadius: '10px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                      >
                        {t('routesBookRideBtn')} <ChevronRight size={14} style={{ transform: language === 'ar' ? 'rotate(180deg)' : 'none' }} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* RIGHT COLUMN: ACTIVE ROUTE MAP & TIMELINE */}
          {activeRoute && (
            <div className="routes-explorer-sidebar">
              
              {/* INTERACTIVE MAP */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '24px',
                overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(0,0,0,0.04)'
              }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapIcon size={20} style={{ color: 'var(--primary)' }} /> {t('routesInteractiveTrack')}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Layers size={14} /> {t('routesSnappedRoadways')}
                  </span>
                </div>
                
                <div style={{ height: '320px', width: '100%' }}>
                  <div ref={mapContainerRef} style={{ height: '100%', width: '100%', zIndex: 1 }} />
                </div>
              </div>

              {/* TIMELINE SECTION */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '24px',
                padding: '1.5rem',
                boxShadow: '0 10px 30px rgba(0,0,0,0.04)'
              }}>
                <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Navigation size={20} style={{ color: 'var(--primary)' }} /> {t('routesTimelineTitle')}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                  
                  {/* Timeline Connecting Line */}
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    bottom: '12px',
                    left: language === 'ar' ? 'auto' : '15px',
                    right: language === 'ar' ? '15px' : 'auto',
                    width: '2px',
                    background: 'repeating-linear-gradient(to bottom, var(--border) 0px, var(--border) 4px, transparent 4px, transparent 8px)'
                  }} />

                  {activeRoute.checkpoints?.map((cp: any, idx: number) => {
                    const isStart = cp.type === 'START';
                    const isEnd = cp.type === 'END';
                    
                    return (
                      <div 
                        key={`timeline-cp-${idx}`}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '1rem',
                          marginBottom: idx === (activeRoute.checkpoints?.length - 1) ? 0 : '1.5rem',
                          position: 'relative',
                          zIndex: 1
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexGrow: 1 }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {language === 'ar' ? cp.nameAr || cp.name : cp.name}
                          </span>
                          <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <span>⏱️ {cp.bufferTimeMinutes} {t('routesBufferMins')}</span>
                            <span>•</span>
                            <span>🌐 Radius: {cp.geofenceRadiusMeters}m</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

        </div>
      )}
    </div>
  );
}
