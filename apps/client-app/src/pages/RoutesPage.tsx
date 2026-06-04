import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { routesAPI, tripsAPI } from '../services/api';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LanguageContext';
import SEO from '../components/SEO';
import { 
  Map as MapIcon, 
  Clock, 
  ChevronRight, 
  Navigation, 
  Info,
  Layers
} from 'lucide-react';

// Utility to convert Google Drive share links to direct download URLs
function cleanGoogleDriveLink(url: string): string {
  if (!url) return '';
  
  let fileId = '';
  
  if (url.includes('drive.google.com')) {
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      fileId = match[1];
    } else {
      const queryMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (queryMatch && queryMatch[1]) {
        fileId = queryMatch[1];
      }
    }
  } else if (url.includes('lh3.googleusercontent.com')) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      fileId = match[1];
    }
  } else if (url.includes('docs.google.com')) {
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      fileId = match[1];
    }
  }

  if (fileId) {
    // Use direct static CDN link to bypass tracking/redirect blocks in browsers like Brave
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  
  return url;
}

// Fix default marker icon in Vite react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom circular markers for passenger route visualization
const createGreenIcon = (text: string) => new L.DivIcon({
  html: `<div style="background-color: #10B981; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 6px rgba(16,185,129,0.3); font-size: 10px;">${text}</div>`,
  className: 'passenger-div-icon-green',
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const createRedIcon = (text: string) => new L.DivIcon({
  html: `<div style="background-color: #EF4444; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 6px rgba(239,68,68,0.3); font-size: 10px;">${text}</div>`,
  className: 'passenger-div-icon-red',
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const createCheckpointIcon = (num: number) => new L.DivIcon({
  html: `<div style="background-color: #3B82F6; color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 6px rgba(59,130,246,0.3); font-size: 11px;">${num}</div>`,
  className: 'passenger-div-icon-blue',
  iconSize: [26, 26],
  iconAnchor: [13, 13]
});

// Autopan hook to fit the path
function MapAutoFit({ path }: { path: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (path.length > 0) {
      const bounds = L.latLngBounds(path);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [path, map]);
  return null;
}
export default function RoutesPage() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [tripsMap, setTripsMap] = useState<Record<string, any[]>>({});
  const { theme } = useTheme();
  const { t, language } = useTranslation();

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
          const map: Record<string, any[]> = {};
          resolved.forEach((item) => {
            map[item.routeId] = item.trips;
          });
          setTripsMap(map);
        } catch (err) {
          console.error('Error fetching trips for routes:', err);
        }
      })
      .catch(err => console.error('Error fetching routes:', err))
      .finally(() => setLoading(false));
  }, []);

  const activeRoute = routes.find(r => r._id === activeRouteId);

  const polylinePath = activeRoute?.path?.coordinates?.map(
    (coord: number[]) => [coord[1], coord[0]] as [number, number]
  ) || [];

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
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: isActive ? '0 10px 30px rgba(245, 183, 49, 0.12)' : '0 4px 12px rgba(0,0,0,0.03)',
                    transform: isActive ? 'translateY(-2px)' : 'none'
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = 'rgba(245, 183, 49, 0.4)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                >
                  {/* Card Banner */}
                  <div style={{
                    height: '110px',
                    backgroundImage: `url("${cleanGoogleDriveLink(route.coverImage) || 'https://images.unsplash.com/photo-1541462608141-2f58c6e68e98?auto=format&fit=crop&w=600&q=80'}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative'
                  }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 100%)' }} />
                    <span style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: 'rgba(255,255,255,0.2)',
                      backdropFilter: 'blur(8px)',
                      color: '#fff',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '10px',
                      fontWeight: 700
                    }}>
                      {route.distanceKm ? `${route.distanceKm} km` : 'Commute'}
                    </span>
                    
                    <h4 style={{
                      position: 'absolute',
                      bottom: '12px',
                      left: '16px',
                      margin: 0,
                      color: '#fff',
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                    }}>
                      {route.name}
                    </h4>
                  </div>

                  {/* Card Info */}
                  <div style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#10B981', fontWeight: 'bold' }}>{t('routesStartPrefix')}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {startStop ? (language === 'ar' && startStop.nameAr ? startStop.nameAr : startStop.name) : 'Origin'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#EF4444', fontWeight: 'bold' }}>{t('routesEndPrefix')}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {endStop ? (language === 'ar' && endStop.nameAr ? endStop.nameAr : endStop.name) : 'Destination'}
                        </span>
                      </div>
                    </div>

                    {/* Active Trips & Departure Times */}
                    <div 
                      onClick={(e) => {
                        if (tripsMap[route._id]?.length > 0) {
                          e.stopPropagation();
                          handleBook(route._id);
                        }
                      }}
                      style={{ 
                        marginTop: '0.75rem', 
                        marginBottom: '1.25rem',
                        padding: '0.75rem 1rem',
                        background: 'var(--surface-hover)',
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        cursor: tripsMap[route._id]?.length > 0 ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'border-color 0.2s'
                      }}
                      onMouseEnter={e => {
                        if (tripsMap[route._id]?.length > 0) {
                          e.currentTarget.style.borderColor = 'rgba(245, 183, 49, 0.4)';
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
              
              {/* INTERACTIVE LEAFLET MAP */}
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
                  <MapContainer 
                    center={polylinePath[0] || [30.0444, 31.2357]} 
                    zoom={12} 
                    style={{ height: '100%', width: '100%', zIndex: 1 }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                      url={theme === 'dark'
                        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'}
                    />
                    
                    {polylinePath.length > 0 && <MapAutoFit path={polylinePath} />}
                    
                    {polylinePath.length > 0 && (
                      <Polyline positions={polylinePath} color="var(--primary)" weight={5} opacity={0.8} />
                    )}

                    {activeRoute.checkpoints?.map((cp: any, idx: number) => {
                      const latLng: [number, number] = [cp.location.coordinates[1], cp.location.coordinates[0]];
                      const isStart = cp.type === 'START';
                      const isEnd = cp.type === 'END';
                      
                      let customIcon;
                      if (isStart) customIcon = createGreenIcon('S');
                      else if (isEnd) customIcon = createRedIcon('E');
                      else customIcon = createCheckpointIcon(idx);

                      return (
                        <Marker 
                          key={`map-cp-${idx}`}
                          position={latLng}
                          icon={customIcon}
                        >
                          <Popup>
                            <div style={{ fontFamily: 'Inter, sans-serif' }}>
                              <strong style={{ display: 'block', fontSize: '13px' }}>{language === 'ar' && cp.nameAr ? cp.nameAr : cp.name}</strong>
                              {language !== 'ar' && cp.nameAr && <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>{cp.nameAr}</span>}
                              {language === 'ar' && cp.name && <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>{cp.name}</span>}
                              <hr style={{ margin: '6px 0', border: 'none', borderBottom: '1px solid #eee' }} />
                              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                {language === 'ar' ? 'النوع:' : 'Type:'} {cp.type === 'START' ? t('routesOriginTerminal') : cp.type === 'END' ? t('routesFinalTerminal') : t('routesStopNum', { num: cp.order })}<br />
                                {language === 'ar' ? 'الترتيب:' : 'Order:'} {cp.order}<br />
                                {language === 'ar' ? 'وقت الانتظار:' : 'Wait Buffer:'} {cp.bufferTimeMinutes} {language === 'ar' ? 'دقائق' : 'mins'}<br />
                                {language === 'ar' ? 'السياج الجغرافي:' : 'Geofence:'} {cp.geofenceRadiusMeters} {language === 'ar' ? 'متر' : 'meters'}
                              </span>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
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
                    top: '15px',
                    bottom: '15px',
                    left: language === 'ar' ? 'auto' : '14px',
                    right: language === 'ar' ? '14px' : 'auto',
                    width: '3px',
                    backgroundColor: 'var(--border)',
                    zIndex: 0
                  }} />

                  {/* Timeline Items */}
                  {activeRoute.checkpoints?.map((cp: any, idx: number) => {
                    const isStart = cp.type === 'START';
                    const isEnd = cp.type === 'END';
                    const color = isStart ? '#10B981' : isEnd ? '#EF4444' : '#3B82F6';

                    return (
                      <div 
                        key={idx} 
                        style={{ 
                          display: 'flex', 
                          gap: '1.5rem', 
                          marginBottom: idx < activeRoute.checkpoints.length - 1 ? '1.5rem' : 0, 
                          position: 'relative',
                          zIndex: 1,
                          flexDirection: language === 'ar' ? 'row-reverse' : 'row'
                        }}
                      >
                        {/* Timeline Pin */}
                        <div style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--surface)',
                          border: `3px solid ${color}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '10px',
                          color: color,
                          boxShadow: '0 3px 8px rgba(0,0,0,0.05)',
                          flexShrink: 0
                        }}>
                          {isStart ? 'S' : isEnd ? 'E' : idx}
                        </div>

                        {/* Timeline Details */}
                        <div style={{
                          background: 'var(--surface-elevated)',
                          borderRadius: '16px',
                          padding: '1rem 1.25rem',
                          flex: 1,
                          border: '1px solid var(--border)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexDirection: language === 'ar' ? 'row-reverse' : 'row',
                          textAlign: language === 'ar' ? 'right' : 'left'
                        }}>
                          <div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: color, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '2px' }}>
                              {isStart ? t('routesOriginTerminal') : isEnd ? t('routesFinalTerminal') : t('routesStopNum', { num: idx })}
                            </span>
                            <strong style={{ fontSize: '1rem', color: 'var(--text-primary)', display: 'block' }}>{language === 'ar' && cp.nameAr ? cp.nameAr : cp.name}</strong>
                            {language === 'ar' && cp.name && cp.nameAr && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>{cp.name}</span>}
                            {language !== 'ar' && cp.nameAr && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>{cp.nameAr}</span>}
                            {cp.purpose && cp.purpose !== 'BOTH' && (
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                marginTop: '6px',
                                backgroundColor: cp.purpose === 'REST' ? 'rgba(239, 68, 68, 0.15)' : cp.purpose === 'DROP_OFF' ? 'rgba(245, 183, 49, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                color: cp.purpose === 'REST' ? '#EF4444' : cp.purpose === 'DROP_OFF' ? '#F5B731' : '#3B82F6',
                                border: `1px solid ${cp.purpose === 'REST' ? 'rgba(239, 68, 68, 0.25)' : cp.purpose === 'DROP_OFF' ? 'rgba(245, 183, 49, 0.25)' : 'rgba(59, 130, 246, 0.25)'}`
                              }}>
                                {cp.purpose === 'REST' 
                                  ? (language === 'ar' ? 'استراحة فقط' : 'Rest Stop Only') 
                                  : cp.purpose === 'DROP_OFF' 
                                    ? (language === 'ar' ? 'نزول فقط' : 'Drop-off Only') 
                                    : (language === 'ar' ? 'صعود فقط' : 'Pickup Only')}
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: language === 'ar' ? 'left' : 'right', flexDirection: language === 'ar' ? 'row-reverse' : 'row' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>{t('routesBuffer')}</span>
                              <strong style={{ color: 'var(--text-primary)' }}>{cp.bufferTimeMinutes || 0} {language === 'ar' ? 'دقائق' : 'mins'}</strong>
                            </div>
                            <div style={{ width: '1px', backgroundColor: 'var(--border)', margin: '0 4px' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ color: 'var(--text-muted)' }}>{t('routesGeofence')}</span>
                              <strong style={{ color: 'var(--text-primary)' }}>{cp.geofenceRadiusMeters || 50}m</strong>
                            </div>
                          </div>
                        </div>

                      </div>
                    );
                  })}

                </div>

                <div style={{
                  marginTop: '1.5rem',
                  padding: '1rem',
                  background: 'rgba(245, 183, 49, 0.08)',
                  border: '1px solid rgba(245, 183, 49, 0.15)',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'start',
                  gap: '8px',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  flexDirection: language === 'ar' ? 'row-reverse' : 'row',
                  textAlign: language === 'ar' ? 'right' : 'left'
                }}>
                  <Info size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>{t('routesComplianceTitle')}</strong> {t('routesComplianceDesc')}
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
