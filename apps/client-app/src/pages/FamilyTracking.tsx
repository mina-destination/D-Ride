import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { socketService } from '../services/socket';
import api from '../services/api';
import { useTranslation } from '../context/LanguageContext';
import SEO from '../components/SEO';
import { Compass, Search, AlertCircle, Phone } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
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

  // Telemetry & Animation States & Refs
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [isStale, setIsStale] = useState(false);
  const animRef = useRef<number | null>(null);
  const currentCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const isFirstLocationRef = useRef(true);

  const startMarkerAnimation = (start: { lat: number; lng: number }, end: { lat: number; lng: number }) => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
    }

    const duration = 3000; // ms between updates
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const currentLat = start.lat + (end.lat - start.lat) * progress;
      const currentLng = start.lng + (end.lng - start.lng) * progress;

      currentCoordsRef.current = { lat: currentLat, lng: currentLng };
      
      if (busMarkerRef.current) {
        busMarkerRef.current.setLngLat([currentLng, currentLat]);
      }

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);
  };

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

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: theme === 'dark' ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/positron',
      center: centerCoords,
      zoom: 14,
      attributionControl: false
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
      // Add static markers for start and end terminals if coordinates exist
      if (routeCoords.length > 0) {

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
      el.style.transition = 'opacity 0.5s ease';

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
      currentCoordsRef.current = location;
    } else {
      if (!animRef.current) {
        busMarkerRef.current.setLngLat(busCoords);
      }
    }

    if (isFirstLocationRef.current) {
      map.flyTo({ center: busCoords, zoom: map.getZoom(), animate: true });
      isFirstLocationRef.current = false;
    }
  }, [location]);

  // Effect to update marker opacity on stale state changes
  useEffect(() => {
    if (busMarkerRef.current) {
      const element = busMarkerRef.current.getElement();
      if (element) {
        element.style.opacity = isStale ? '0.45' : '1';
      }
    }
  }, [isStale]);

  // Interval check for stale connection (signal quality)
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastUpdateTime;
      setIsStale(elapsed > 30000);
    }, 5000);
    return () => clearInterval(interval);
  }, [lastUpdateTime]);

  // WebSocket connection & telemetry room subscription
  useEffect(() => {
    if (!booking?.tripId?.vehicle?._id || !code) return;

    const vehicleId = booking.tripId.vehicle._id;

    socketService.connect();
    socketService.subscribeToVehicle(vehicleId, code);

    const handleLocationUpdate = (data: any) => {
      if (data.vehicleId === vehicleId && data.location) {
        const newCoords = { lat: data.location.latitude, lng: data.location.longitude };
        const oldCoords = currentCoordsRef.current;

        setLastUpdateTime(Date.now());
        setIsStale(false);

        if (oldCoords) {
          startMarkerAnimation(oldCoords, newCoords);
        } else {
          setLocation(newCoords);
          currentCoordsRef.current = newCoords;
        }

        const map = mapRef.current;
        if (map) {
          map.panTo([newCoords.lng, newCoords.lat], { duration: 1000 });
        }
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
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
      socketService.unsubscribeFromVehicle(vehicleId);
      socketService.offVehicleLocationUpdate(handleLocationUpdate);
      socketService.offCheckpointUpdate(handleCheckpointUpdate);
      socketService.disconnect();
    };
  }, [booking?.tripId?.vehicle?._id, code]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    setSearchParams({ code: inputCode.trim() });
    setCode(inputCode.trim());
  };

  // 1. Initial State: Code Entry Screen
  if (!code) {
    return (
      <div className="auth-page py-20 px-6">
        <SEO title={seoTitle} description={seoDescription} />
        <Card className="max-w-[460px] mx-auto text-center bg-[#121224]/80 backdrop-blur-xl border-white/10 shadow-2xl">
          <CardContent className="p-8">
            <div className="w-16 h-16 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/40 flex items-center justify-center mx-auto mb-6 shadow-[0_0_15px_rgba(245,183,49,0.2)]">
              <Compass size={28} className="text-[var(--primary)]" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              {isAr ? 'تتبع رحلة عائلتك' : 'Track Family Ride'}
            </h1>
            <p className="text-[var(--text-muted)] text-sm mb-6 leading-relaxed">
              {isAr
                ? 'أدخل رمز تذكرة (UUID) أحد أفراد عائلتك لتتبع موقع حافلتهم الجغرافي بشكل مباشر وفي الوقت الفعلي.'
                : 'Enter your family member\'s shared ticket ID (UUID) to follow their shuttle bus location on the map in real-time.'}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="relative">
                <Input
                  type="text"
                  value={inputCode}
                  onChange={e => setInputCode(e.target.value)}
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  className={`${isRtl ? 'pl-10 pr-4' : 'pr-10 pl-4'} w-full bg-white/5 border-white/10 text-white placeholder:text-white/30`}
                  required
                />
                <Search size={18} className={`absolute top-1/2 -translate-y-1/2 text-[var(--text-muted)] ${isRtl ? 'left-3' : 'right-3'}`} />
              </div>
              <Button type="submit" className="w-full bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-black font-bold gap-2">
                {isAr ? 'ابدأ التتبع المباشر 📡' : 'Start Live Tracking 📡'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="auth-page py-20 px-6">
        <SEO title={seoTitle} description={seoDescription} />
        <Card className="max-w-[460px] mx-auto text-center bg-[#121224]/80 backdrop-blur-xl border-white/10 shadow-2xl">
          <CardContent className="p-8">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-6 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
              <AlertCircle size={28} className="text-[var(--danger)]" />
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
              {isAr ? 'عذراً، فشل التحميل' : 'Tracking Failed'}
            </h2>
            <p className="text-[var(--text-secondary)] text-sm mb-6 leading-relaxed">
              {error}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => { setCode(null); setSearchParams({}); }}
                className="flex-1 border-white/10 text-[var(--text-primary)] hover:bg-white/5"
              >
                {isAr ? 'محاولة رمز آخر' : 'Try Another Code'}
              </Button>
              <Button asChild className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-black font-bold">
                <Link to="/">
                  {isAr ? 'العودة للرئيسية' : 'Back Home'}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 3. Loading State
  if (loading || !booking) {
    return (
      <div className="auth-page">
        <SEO title={seoTitle} description={seoDescription} />
        <div className="text-center py-24 px-6 text-[var(--text-muted)]">
          <div className="app-loading-spinner mx-auto mb-6" />
          <span>{isAr ? 'جاري تحميل تفاصيل التذكرة...' : 'Loading ticket details...'}</span>
        </div>
      </div>
    );
  }

  // 4. Live Map Telemetry Interface
  return (
    <div className="h-screen flex flex-col relative">
      <SEO title={seoTitle} description={seoDescription} />
      <div className="flex-1 relative">

        {/* Floating Family Member Details Card */}
        <Card className="absolute top-5 left-5 w-80 max-h-[calc(100%-40px)] overflow-y-auto z-[1000] bg-[var(--surface)]/95 backdrop-blur-xl border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.25)] animate-fade-in-up">
          <CardContent className="p-5 flex flex-col gap-3 text-left">
            <div className="flex justify-between items-center">
              <Badge
                className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${
                  !location
                    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                    : isStale
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  !location 
                    ? 'bg-red-400' 
                    : isStale 
                    ? 'bg-amber-400 animate-pulse' 
                    : 'bg-emerald-400 animate-pulse'
                }`} />
                {!location 
                  ? (isAr ? 'غير متصل بالبث 🕒' : 'Offline') 
                  : isStale 
                  ? (isAr ? 'إشارة ضعيفة ⚠️' : 'Weak Signal ⚠️') 
                  : (isAr ? 'بث الموقع نشط 📡' : 'Live Tracking 📡')
                }
              </Badge>
              <button
                onClick={() => { setCode(null); setSearchParams({}); }}
                className="text-[10px] text-[var(--primary)] font-bold cursor-pointer bg-transparent border-none p-0 hover:underline"
              >
                {isAr ? 'تغيير الرمز ✕' : 'Change Code ✕'}
              </button>
            </div>

            <h1 className="text-lg font-extrabold text-[var(--text-primary)] mt-1 leading-tight">
              {isRtl ? (booking.tripId?.routeId?.nameAr || booking.tripId?.routeId?.name || 'رحلة حافلة') : (booking.tripId?.routeId?.name || 'Bus Route')}
            </h1>

            <div className="bg-[var(--surface-elevated)] p-3 rounded-lg border border-[var(--border)] text-[11px] text-[var(--text-secondary)]">
              <strong>{isAr ? 'الراكب المتابع:' : 'Passenger:'}</strong> {booking.userId?.name || 'Family Member'} <br />
              <strong>{isAr ? 'المقاعد المحجوزة:' : 'Seat(s):'}</strong> #{booking.seatNumbers?.join(', ') || booking.seatNumber || '1'}
            </div>

            <hr className="border-t border-[var(--border)] my-1" />

            {/* Vehicle & Driver Details */}
            <div className="flex flex-col gap-2 text-[11px] my-1">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">{t('vehicleModel')}</span>
                <span className="font-bold text-[var(--text-primary)]">
                  {booking.tripId?.vehicle?.model ? booking.tripId.vehicle.model.replace('::', ' ') : 'Toyota HiAce'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">{t('licensePlate')}</span>
                <span className="font-bold text-[var(--text-primary)]">
                  {booking.tripId?.vehicle?.plateNumber || booking.tripId?.vehicle?.licensePlate || ' ط ر ق ٥٤٣٢'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">{t('driverPartner')}</span>
                <span className="font-bold text-[var(--text-primary)]">
                  {booking.tripId?.driverId?.name || (isAr ? 'كابتن محمد حجازي' : 'Capt. Mohamed Hegazi')}
                </span>
              </div>
            </div>

            {booking.tripId?.driverId?.phone && (
              <div className="mt-1">
                <a
                  href={`tel:${booking.tripId.driverId.phone}`}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-[var(--primary)] text-black font-bold text-[11px] no-underline transition-all hover:opacity-90"
                >
                  <Phone size={14} fill="black" /> {isAr ? 'اتصل بالسائق الشريك' : 'Call Driver Partner'}
                </a>
              </div>
            )}

            {/* Live Checkpoint Progress */}
            {booking.tripId?.routeId?.checkpoints && (
              <div className="mt-3 text-left">
                <span className="text-[10px] font-extrabold uppercase text-[var(--text-muted)] tracking-wide">
                  {isAr ? 'مسار الرحلة والوصول:' : 'Route Checkpoints:'}
                </span>
                <div className="flex flex-col gap-2 mt-2 p-3 bg-[var(--surface-elevated)] rounded-lg border border-[var(--border)]">
                  {booking.tripId.routeId.checkpoints
                    .slice()
                    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                    .map((cp: any, idx: number) => {
                      const isArrived = arrivedCheckpoints.includes(cp.name);
                      return (
                        <div key={cp.name || idx} className="flex items-center gap-2 text-[11px]">
                          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${
                            isArrived
                              ? 'bg-[var(--primary)] border border-[var(--primary)] text-black'
                              : 'bg-white/5 border border-white/20 text-[var(--text-muted)]'
                          }`}>
                            {isArrived ? '✓' : ''}
                          </div>
                          <span className={`${
                            isArrived
                              ? 'text-[var(--text-muted)] line-through font-medium'
                              : 'text-[var(--text-primary)] font-semibold'
                          }`}>
                            {isAr ? (cp.nameAr || cp.name) : cp.name}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div ref={mapContainerRef} className="h-full w-full z-0" />
      </div>
    </div>
  );
}
