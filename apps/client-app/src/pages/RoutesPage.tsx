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
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

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
      style: theme === 'dark' ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/positron',
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

      // Map markers — inline styles required (DOM API)
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
    <Card className="overflow-hidden flex flex-col h-full transition-transform duration-[250ms] ease-out route-card-hover shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      {/* 1. CARD HEADER */}
      <div className={`p-6 flex flex-col gap-3 border-b border-[var(--border)]`}>
        <div className={`flex justify-between items-center ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 px-3 py-1 rounded-[10px] text-xs font-bold uppercase tracking-wide">
            🚌 {route.routeCode || `LINE ${route.name.split(' ')[0] || ''}`}
          </Badge>
          <div className={`flex flex-col ${isAr ? 'items-start' : 'items-end'}`}>
            <span className="text-xl font-extrabold text-[var(--primary)]">
              {minPrice} <span className="text-sm font-semibold">{isAr ? 'ج.م' : 'EGP'}</span>
            </span>
          </div>
        </div>

        <div>
          <h3 className={`m-0 mb-1 text-[1.35rem] font-extrabold text-[var(--text-primary)] leading-tight ${isAr ? 'text-right' : 'text-left'}`}>
            {isAr ? route.nameAr || route.name : route.name}
          </h3>
          <p className={`m-0 text-sm text-[var(--text-secondary)] flex items-center gap-1 ${isAr ? 'justify-end flex-row-reverse' : 'justify-start flex-row'}`}>
            <span>📍</span> <span>{startStop?.name || 'Origin'} ➔ {endStop?.name || 'Destination'}</span>
          </p>
        </div>

        {/* METADATA CHIPS */}
        <div className={`flex flex-wrap gap-2 mt-1 ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={`bg-[var(--background)] border border-[var(--border)] px-3 py-1.5 rounded-xl text-xs text-[var(--text-secondary)] flex items-center gap-1.5 ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
            <Clock size={14} className="text-[var(--primary)]" />
            <span>{t('routesDurationMins', { count: route.estimatedDurationMinutes || 30 })}</span>
          </div>
          <div className={`bg-[var(--background)] border border-[var(--border)] px-3 py-1.5 rounded-xl text-xs text-[var(--text-secondary)] flex items-center gap-1.5 ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
            <span>📏</span>
            <span>{route.distanceKm} km</span>
          </div>
          <div className={`bg-[var(--background)] border border-[var(--border)] px-3 py-1.5 rounded-xl text-xs text-[var(--text-secondary)] flex items-center gap-1.5 ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
            <span>🗓️</span>
            <span>{trips && trips.length > 0 ? t('routesTripsScheduled', { count: trips.length }) : t('routesNoTripsScheduled')}</span>
          </div>
        </div>
      </div>

      {/* 2. MAP CONTROLLER CONTAINER */}
      <div className="h-[220px] w-full relative bg-[var(--background)]">
        <div ref={mapContainerRef} className="h-full w-full" />
        {/* Floating marker counts badge */}
        <div className={`absolute bottom-3 ${isAr ? 'right-3' : 'left-3'} bg-slate-900/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-xs font-semibold z-[5] border border-white/10 flex items-center gap-1.5 ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
          <Layers size={12} className="text-[var(--primary)]" />
          <span>{route.checkpoints?.length || 0} {isAr ? 'محطات' : 'Stations'}</span>
        </div>
      </div>

      {/* 3. COLLAPSIBLE TIMELINE / CHECKPOINTS */}
      <div className="border-b border-[var(--border)]">
        <button
          onClick={() => setShowTimeline(!showTimeline)}
          className={`w-full px-6 py-4 bg-transparent border-none outline-none cursor-pointer flex justify-between items-center text-sm font-bold text-[var(--text-secondary)] transition-colors duration-200 hover:bg-[var(--background)] ${isAr ? 'flex-row-reverse' : 'flex-row'}`}
        >
          <span className={`flex items-center gap-2 ${isAr ? 'flex-row-reverse' : 'flex-row'}`}>
            <Navigation size={16} className="text-[var(--primary)]" />
            {isAr ? 'عرض تفاصيل المحطات ومخطط الخط' : 'Show Stop Details & Timeline'}
          </span>
          {showTimeline ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showTimeline && (
          <div className="p-6 bg-[var(--background)] border-t border-[var(--border)] flex flex-col relative">
            {/* Timeline Connecting Line */}
            <div
              className={`absolute top-9 bottom-9 w-[2px] ${isAr ? 'right-10' : 'left-10'}`}
              style={{ background: 'repeating-linear-gradient(to bottom, var(--border) 0px, var(--border) 4px, transparent 4px, transparent 8px)' }}
            />

            {route.checkpoints?.map((cp: any, idx: number) => {
              const isStart = cp.type === 'START';
              const isEnd = cp.type === 'END';
              
              return (
                <div 
                  key={`timeline-cp-${route._id}-${idx}`}
                  className={`flex items-start gap-4 relative z-[1] ${isAr ? 'flex-row-reverse' : 'flex-row'} ${idx === (route.checkpoints?.length - 1) ? '' : 'mb-6'}`}
                >
                  {/* Bullet indicator */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border-2 ${
                    isStart 
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-500' 
                      : isEnd 
                        ? 'bg-red-500/15 border-red-500 text-red-500' 
                        : 'bg-blue-500/10 border-blue-500 text-blue-500'
                  }`}>
                    {isStart ? 'S' : isEnd ? 'E' : String(idx)}
                  </div>

                  {/* Text info */}
                  <div className={`flex flex-col gap-0.5 grow ${isAr ? 'text-right' : 'text-left'}`}>
                    <span className="text-[0.95rem] font-bold text-[var(--text-primary)]">
                      {isAr ? cp.nameAr || cp.name : cp.name}
                    </span>
                    <div className={`flex gap-2 text-xs text-[var(--text-muted)] ${isAr ? 'justify-end flex-row-reverse' : 'justify-start flex-row'}`}>
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
      <div className={`px-6 py-5 bg-[var(--surface-hover)] flex mt-auto ${isAr ? 'justify-start' : 'justify-end'}`}>
        <Button 
          onClick={() => onBook(route._id)}
          className={`bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-black font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-1.5 transition-all duration-200 shadow-[0_4px_15px_rgba(245,183,49,0.15)] hover:scale-[1.02] ${isAr ? 'flex-row-reverse' : 'flex-row'}`}
        >
          {t('routesBookRideBtn')} 
          <ChevronRight size={16} className={isAr ? 'rotate-180' : ''} />
        </Button>
      </div>
    </Card>
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
    <div className="min-h-[calc(100vh-72px)] bg-[var(--background)] text-[var(--text-primary)] font-[var(--font-family)]">
      <SEO title={seoTitle} description={seoDescription} keywords="egypt routes, bus routes, cairo to sharm, alex to dahab, nuweiba, taba" />
      
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-br from-[#1A1A2E] to-[#0F0F1A] pt-[8.5rem] pb-14 px-8 border-b border-[var(--border)] relative overflow-clip text-center">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#F5B731 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        
        <div className="max-w-[800px] mx-auto relative z-[1]">
          <Badge variant="outline" className="bg-[rgba(245,183,49,0.15)] text-[var(--primary)] border-[rgba(245,183,49,0.25)] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-4 inline-block">
            {t('routesCommuteNetworks')}
          </Badge>
          <h1 className="text-[2.5rem] font-extrabold text-white m-0 mb-2 tracking-tight">
            {t('routesExplorerTitle')}
          </h1>
          <p className="text-base text-[var(--text-muted)] m-0 leading-relaxed">
            {t('routesExplorerDesc')}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-[400px] gap-4">
          <div className="app-loading-spinner w-10 h-10 border-[3px] border-[rgba(245,183,49,0.1)] border-t-[var(--primary)] rounded-full animate-spin" />
          <span className="text-[var(--text-secondary)] font-medium">{t('routesLoading')}</span>
        </div>
      ) : routes.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center">
          <MapIcon size={64} className="text-[var(--text-muted)] mb-6" />
          <h2 className="text-2xl font-bold m-0 mb-2">{t('routesNoRegisteredTitle')}</h2>
          <p className="text-[var(--text-secondary)] max-w-[400px] m-0">
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
