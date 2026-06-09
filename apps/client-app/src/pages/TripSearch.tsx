import { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { tripsAPI, routesAPI } from '../services/api';
import { useTranslation } from '../context/LanguageContext';
import SEO from '../components/SEO';
import { CustomDatePicker } from '../components/CustomDatePicker';

// Map imports removed

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

function haversineDistance(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6371e3; // meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

const getRelativeDateLabel = (groupDateStr: string, targetDateStr?: string, isRtl?: boolean) => {
  const [y, m, d] = groupDateStr.split('-').map(Number);
  const groupDate = new Date(y, m - 1, d);
  
  const formatted = groupDate.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });

  // Calculate diff days relative to actual today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTimeToday = groupDate.getTime() - today.getTime();
  const diffDaysToday = Math.round(diffTimeToday / (1000 * 60 * 60 * 24));

  // If it's the selected date, prioritize that label
  if (targetDateStr && groupDateStr === targetDateStr) {
    return isRtl ? `🎯 ${formatted} (التاريخ المحدد)` : `🎯 ${formatted} (Selected Date)`;
  }

  // Relative to actual today
  if (diffDaysToday === 0) {
    return isRtl ? `📅 ${formatted} (اليوم)` : `📅 ${formatted} (Today)`;
  }
  if (diffDaysToday === 1) {
    return isRtl ? `📅 ${formatted} (غداً)` : `📅 ${formatted} (Tomorrow)`;
  }
  if (diffDaysToday === -1) {
    return isRtl ? `📅 ${formatted} (أمس)` : `📅 ${formatted} (Yesterday)`;
  }

  // For other dates, return formatted (with calendar emoji if a target date is searched)
  if (!targetDateStr) return formatted;
  return `📅 ${formatted}`;
};

// Map configurations removed

export default function TripSearchPage() {
  const { t, isRtl, language } = useTranslation();
  const [searchParams] = useSearchParams();
  const routeId = searchParams.get('routeId');
  const pickupLat = searchParams.get('pickupLat');
  const pickupLng = searchParams.get('pickupLng');
  const dropoffLat = searchParams.get('dropoffLat');
  const dropoffLng = searchParams.get('dropoffLng');
  const pickupCity = searchParams.get('pickupCity') || undefined;
  const dropoffCity = searchParams.get('dropoffCity') || undefined;
  const date = searchParams.get('date') || undefined;
  const passengers = searchParams.get('passengers') ? parseInt(searchParams.get('passengers')!, 10) : 1;

  const navigate = useNavigate();

  const isAr = language === 'ar';
  const seoTitle = isAr ? 'الرحلات والحافلات المتاحة | دي-رايد' : 'Available Commute Minibuses | D-Ride';
  const seoDescription = isAr
    ? 'تصفح مواعيد رحلات دي-رايد وجداول المقاعد وأسعار التذاكر لخطوط القاهرة، الإسكندرية، شرم الشيخ، دهب، نويبع، وطابا.'
    : 'Browse scheduled D-Ride trip times, seat availability, and pricing for routes connecting Cairo, Alexandria, Sharm, Dahab, Nuweiba, and Taba.';

  const dateString = useMemo(() => {
    if (!date) return t('next5days');
    const [year, month, day] = date.split('-').map(Number);
    const parsedDate = new Date(year, month - 1, day);
    return parsedDate.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }, [date, isRtl, t]);

  const todayLocalStr = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const [route, setRoute] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCheckpoints, setSelectedCheckpoints] = useState<Record<string, string>>({});
  const [selectedDropoffCheckpoints, setSelectedDropoffCheckpoints] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState<'earliest' | 'cheapest' | 'walks'>('earliest');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const requestGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('Geolocation permission denied or failed on search page:', error);
          alert(
            isRtl 
              ? 'الرجاء تفعيل إذن الوصول للموقع الجغرافي لتحديد المسافة للمحطة.' 
              : 'Please enable location permission in your browser to calculate distance to the station.'
          );
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    } else {
      alert(
        isRtl 
          ? 'تحديد الموقع الجغرافي غير مدعوم في متصفحك.' 
          : 'Geolocation is not supported by your browser.'
      );
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('Geolocation permission denied or failed on search page:', error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    }
  }, []);

  // Active trip state
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const targetRef = useRef<HTMLDivElement>(null);

  const isSmartMode = useMemo(() => {
    return !!(pickupLat && pickupLng && dropoffLat && dropoffLng);
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  const filteredTrips = useMemo(() => {
    if (!trips || trips.length === 0) return [];
    
    const now = new Date();
    if (!date) {
      // Show trips for the next 5 days (today inclusive to today + 5 days exclusive)
      const start = now;
      
      const end = new Date();
      end.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + 5);
      
      return trips.filter((trip) => {
        const tripDate = new Date(trip.departureTime);
        return tripDate >= start && tripDate < end;
      });
    } else {
      // Specific date search: shows from this date 2 days before and 2 days after (5 days total centered on date)
      const [year, month, day] = date.split('-').map(Number);
      const targetDate = new Date(year, month - 1, day);
      
      const start = new Date(targetDate);
      start.setDate(targetDate.getDate() - 2);
      
      const end = new Date(targetDate);
      end.setDate(targetDate.getDate() + 3); // 3 days after target date 00:00:00 (exclusive)
      
      return trips.filter((trip) => {
        const tripDate = new Date(trip.departureTime);
        return tripDate >= start && tripDate >= now && tripDate < end;
      });
    }
  }, [trips, date]);

  const sortedTrips = useMemo(() => {
    const list = [...filteredTrips];
    if (sortBy === 'earliest') {
      list.sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());
    } else if (sortBy === 'cheapest') {
      list.sort((a, b) => a.priceEGP - b.priceEGP);
    } else if (sortBy === 'walks') {
      list.sort((a, b) => (a.totalWalkingDistance || 0) - (b.totalWalkingDistance || 0));
    }
    return list;
  }, [filteredTrips, sortBy]);

  useEffect(() => {
    if (sortedTrips.length > 0) {
      const activeExists = sortedTrips.some(t => t._id === activeTripId);
      if (!activeExists) {
        setActiveTripId(sortedTrips[0]._id);
      }
    } else {
      setActiveTripId(null);
    }
  }, [sortedTrips, activeTripId]);

  // Group filtered & sorted trips by local date string (YYYY-MM-DD)
  const groupedTrips = useMemo(() => {
    const groups: Record<string, typeof sortedTrips> = {};
    sortedTrips.forEach((trip) => {
      const depTime = new Date(trip.departureTime);
      const y = depTime.getFullYear();
      const m = String(depTime.getMonth() + 1).padStart(2, '0');
      const d = String(depTime.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${d}`;
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(trip);
    });
    
    return Object.keys(groups)
      .sort()
      .map((key) => ({
        dateKey: key,
        trips: groups[key],
      }));
  }, [sortedTrips]);

  useEffect(() => {
    if (date && !loading) {
      const timer = setTimeout(() => {
        targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [date, loading, trips]);

  useEffect(() => {
    setLoading(true);

    if (isSmartMode) {
      routesAPI.smartSearch(
        parseFloat(pickupLat!),
        parseFloat(pickupLng!),
        parseFloat(dropoffLat!),
        parseFloat(dropoffLng!),
        undefined,
        pickupCity,
        dropoffCity,
        date || undefined
      )
        .then((smartRoutes: any[]) => {
          let allTrips = smartRoutes.map((sr: any) => ({
            ...sr.trip,
            route: sr.trip.routeId || sr.trip.route,
            pickupCheckpoint: {
              ...sr.trip?.pickupCheckpoint,
              ...sr.pickupCheckpoint,
            },
            dropoffCheckpoint: {
              ...sr.trip?.dropoffCheckpoint,
              ...sr.dropoffCheckpoint,
            },
            totalWalkingDistance: sr.totalWalkingDistance,
          }));

          // Filter by passengers count if needed
          if (passengers > 1) {
            allTrips = allTrips.filter((t) => {
              const lockedCount = t.lockedSeats ? t.lockedSeats.length : 0;
              const seatsLeft = t.availableSeats - t.bookedSeats - lockedCount;
              return seatsLeft >= passengers;
            });
          }

          // Sort by walking distance
          allTrips.sort((a, b) => a.totalWalkingDistance - b.totalWalkingDistance);

          setTrips(allTrips);
          if (allTrips.length > 0) {
            setActiveTripId(allTrips[0]._id);
          }

          // Setup selected checkpoints
          const initialPickups: Record<string, string> = {};
          const initialDropoffs: Record<string, string> = {};
          allTrips.forEach((t) => {
            initialPickups[t._id] = t.pickupCheckpoint.name;
            initialDropoffs[t._id] = t.dropoffCheckpoint.name;
          });
          setSelectedCheckpoints(initialPickups);
          setSelectedDropoffCheckpoints(initialDropoffs);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else if (routeId) {
      const initialCpName = searchParams.get('checkpointName') || undefined;
      Promise.all([
        routesAPI.getAll().then(res => res.find((r: any) => r._id === routeId)),
        tripsAPI.search(routeId, date, initialCpName)
      ])
      .then(([routeData, tripsData]) => {
        setRoute(routeData);
        
        let filteredTrips = tripsData;
        if (passengers > 1) {
          filteredTrips = filteredTrips.filter((t: any) => {
            const lockedCount = t.lockedSeats ? t.lockedSeats.length : 0;
            const seatsLeft = t.availableSeats - t.bookedSeats - lockedCount;
            return seatsLeft >= passengers;
          });
        }
        setTrips(filteredTrips);
        if (filteredTrips.length > 0) {
          setActiveTripId(filteredTrips[0]._id);
        }

        // Initialize pre-selected checkpoints from search param
        if (routeData?.checkpoints && routeData.checkpoints.length > 0) {
          const initialCpName = searchParams.get('checkpointName') || '';
          const hasMatch = routeData.checkpoints.some((cp: any) => cp.name === initialCpName);
          const defaultCp = hasMatch ? initialCpName : routeData.checkpoints[0].name;
          
          const initialSelections: Record<string, string> = {};
          const initialDropoffSelections: Record<string, string> = {};
          const defaultDropoffCp = routeData.checkpoints[routeData.checkpoints.length - 1].name;
          
          tripsData.forEach((trip: any) => {
            initialSelections[trip._id] = defaultCp;
            initialDropoffSelections[trip._id] = defaultDropoffCp;
          });
          setSelectedCheckpoints(initialSelections);
          setSelectedDropoffCheckpoints(initialDropoffSelections);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [routeId, pickupLat, pickupLng, dropoffLat, dropoffLng, passengers, isSmartMode, searchParams, date]);

  if (!routeId && !isSmartMode) {
    return (
      <div className="auth-page">
        <SEO title={seoTitle} description={seoDescription} />
        <div className="auth-card glass" style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--text-primary)' }}>{t('noSearchParameters')}</h1>
          <p>{t('noSearchParametersDesc')}</p>
          <button onClick={() => navigate('/')} className="btn-primary" style={{ marginTop: '1rem' }}>{t('backToHome')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="trip-search-page-container">
      <SEO title={seoTitle} description={seoDescription} />
      <style>{`
         .checkpoint-scrollbar::-webkit-scrollbar {
           display: none;
         }
         .checkpoint-item:hover {
           transform: translateY(-2px);
         }
         
         /* Ant Design Timeline Mock Style (Normal Timeline) */
         .ant-timeline {
           display: flex;
           width: 100%;
           position: relative;
         }
         .ant-timeline-item {
           flex: 1;
           position: relative;
           display: flex;
           flex-direction: column;
           align-items: center;
           text-align: center;
         }
         .ant-timeline-item-tail {
           position: absolute;
           top: 5px;
           left: 50%;
           width: 100%;
           height: 2px;
           background: rgba(255, 255, 255, 0.15);
           z-index: 0;
         }
         .ant-timeline-item:last-child .ant-timeline-item-tail {
           display: none;
         }
         .ant-timeline-item-head {
           width: 10px;
           height: 10px;
           border-radius: 50%;
           background: #141416;
           border: 2px solid var(--primary);
           z-index: 1;
           box-shadow: 0 0 6px var(--primary);
         }
         .ant-timeline-item-content {
           margin-top: 6px;
           display: flex;
           flex-direction: column;
           align-items: center;
         }
         .ant-timeline-item-title {
           font-size: 0.68rem;
           font-weight: 600;
           color: var(--text-primary);
         }
         .ant-timeline-item-time {
           font-size: 0.6rem;
           color: var(--text-muted);
           margin-top: 1px;
         }
         
         /* RTL Layout Support */
         [dir="rtl"] .ant-timeline-item-tail {
           right: 50%;
           left: auto;
         }
      `}</style>
      <div style={{ maxWidth: '950px', width: '100%', margin: '0 auto', padding: '0 1.5rem', boxSizing: 'border-box' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }} className="animate-fade-in-up">
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            {t('availableTrips')}
          </h1>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {isSmartMode ? (
              <div style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem', background: 'var(--surface-hover)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--border)' }}>
                <span>📍</span>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {t('smartSearchSubtitle')}
                </span>
              </div>
            ) : route && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface-hover)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--border)' }}>
                <span>📍</span>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{isRtl ? (route.nameAr || route.name) : route.name}</span>
              </div>
            )}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(245, 183, 49, 0.1)', color: 'var(--primary)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-2xl)', border: '1px solid rgba(245, 183, 49, 0.25)', fontWeight: 700 }}>
              <span>📅</span>
              <span>{dateString}</span>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="glass" style={{ textAlign: 'center', padding: '3rem', borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem' }}>
            <div className="app-loading-spinner"></div>
            <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{t('searchingRides')}</p>
          </div>
        ) : sortedTrips.length === 0 ? (
          <div className="glass" style={{ textAlign: 'center', padding: '4rem 2rem', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{t('noTripsFound')}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{t('noTripsFoundDesc')}</p>
            <button onClick={() => navigate('/')} className="btn-primary">{t('searchAnotherRoute')}</button>
          </div>
        ) : (
          <div>
            {/* Sorting Tabs & Date Selector */}
            <div className="sorting-date-row">
              {/* Sorting Tabs */}
              <div className="sorting-tabs-container">
                <button 
                  onClick={() => setSortBy('earliest')}
                  className={`sorting-tab-btn ${sortBy === 'earliest' ? 'active' : ''}`}
                >
                  🕒 {t('earliest')}
                </button>
                <button 
                  onClick={() => setSortBy('cheapest')}
                  className={`sorting-tab-btn ${sortBy === 'cheapest' ? 'active' : ''}`}
                >
                  💰 {t('cheapest')}
                </button>
                {isSmartMode && (
                  <button 
                    onClick={() => setSortBy('walks')}
                    className={`sorting-tab-btn ${sortBy === 'walks' ? 'active' : ''}`}
                  >
                    🚶 {t('fewestWalks')}
                  </button>
                )}
              </div>

              {/* Date Input Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '180px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('travelDateLabel')}:</span>
                <CustomDatePicker
                  value={date || todayLocalStr}
                  min={todayLocalStr}
                  onChange={(dateStr) => {
                    const newParams = new URLSearchParams(searchParams);
                    newParams.set('date', dateStr);
                    navigate(`/search?${newParams.toString()}`);
                  }}
                />
              </div>
            </div>

            {/* Trip Search Dashboard List */}
            <div className="trip-search-dashboard" style={{ gridTemplateColumns: '1fr' }}>
              
              {/* Left Column: Trip Lists */}
              <div className="trip-list-column">
                {groupedTrips.map((group) => {
                  const isTargetGroup = !date || group.dateKey === date;
                  
                  return (
                    <div key={group.dateKey}>
                      {/* Section Header */}
                      <div 
                        ref={isTargetGroup ? targetRef : undefined}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '1rem', 
                          margin: '2.5rem 0 1.25rem 0',
                          scrollMarginTop: '120px'
                        }}
                      >
                        <span style={{ 
                          fontSize: isTargetGroup ? '1.15rem' : '0.95rem', 
                          fontWeight: 800, 
                          color: isTargetGroup ? 'var(--primary)' : 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.3s ease'
                        }}>
                          {getRelativeDateLabel(group.dateKey, date, isRtl)}
                        </span>
                        <div style={{ 
                          flex: 1, 
                          height: isTargetGroup ? '2px' : '1px', 
                          background: isTargetGroup 
                            ? 'linear-gradient(90deg, var(--primary) 0%, rgba(245, 183, 49, 0.1) 100%)' 
                            : 'linear-gradient(90deg, var(--border) 0%, transparent 100%)',
                          transition: 'all 0.3s ease'
                        }} />
                      </div>

                      {/* Grouped Cards */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {group.trips.map((trip, idx) => {
                          const baseTripDepTime = new Date(trip.departureTime).getTime();
                          const currentRoute = isSmartMode ? trip.route : route;

                          const selectedPickupCpName = selectedCheckpoints[trip._id];
                          const selectedDropoffCpName = selectedDropoffCheckpoints[trip._id];

                          const routeCps = currentRoute?.checkpoints || [];
                          const pickupCp = routeCps.find((cp: any) => cp.name === selectedPickupCpName) || trip.pickupCheckpoint || routeCps[0];
                          const dropoffCp = routeCps.find((cp: any) => cp.name === selectedDropoffCpName) || trip.dropoffCheckpoint || routeCps[routeCps.length - 1];

                          // Resolve estimated departure time (boarding time) via localizedDepartureTime or fallback
                          const pickupEstimatedDepTime = pickupCp?.localizedDepartureTime || pickupCp?.estimatedDepartureTime || (pickupCp?.minutesFromStart !== undefined
                            ? new Date(baseTripDepTime + pickupCp.minutesFromStart * 60 * 1000).toISOString()
                            : undefined);

                          // Resolve estimated arrival time (destination arrival time) via localizedArrivalTime or fallback
                          const dropoffEstimatedArrTime = dropoffCp?.localizedArrivalTime || dropoffCp?.estimatedArrivalTime || (dropoffCp?.minutesFromStart !== undefined
                            ? new Date(baseTripDepTime + dropoffCp.minutesFromStart * 60 * 1000).toISOString()
                            : undefined);

                          const depTime = pickupEstimatedDepTime ? new Date(pickupEstimatedDepTime) : new Date(trip.departureTime);
                          const arrTime = dropoffEstimatedArrTime ? new Date(dropoffEstimatedArrTime) : new Date(depTime.getTime() + 45 * 60000);

                          // Segment localized times bound explicitly
                          const pickupTimeStr = pickupCp?.localizedDepartureTime
                            ? new Date(pickupCp.localizedDepartureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : depTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                          const dropoffTimeStr = dropoffCp?.localizedArrivalTime
                            ? new Date(dropoffCp.localizedArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : arrTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                          const pickupDateStr = depTime.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          });
                          const dropoffDateStr = arrTime.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          });

                          const boardingDate = pickupCp?.localizedDepartureTime 
                            ? new Date(pickupCp.localizedDepartureTime) 
                            : depTime;

                          // Dynamic leg sub-total fare calculation
                          const getTripLegPrice = () => {
                            if (pickupCp && dropoffCp) {
                              if (pickupCp.prices && pickupCp.prices[dropoffCp.name] !== undefined) {
                                return Number(pickupCp.prices[dropoffCp.name]);
                              }
                              const pickupPrice = Number(pickupCp.priceFromStartEGP || 0);
                              const dropoffPrice = Number(dropoffCp.priceFromStartEGP || trip.priceEGP || 0);
                              const legPrice = dropoffPrice - pickupPrice;
                              if (legPrice > 0) return legPrice;
                            }
                            return Number(trip.priceEGP || 0);
                          };
                          const dynamicLegPrice = getTripLegPrice();
                          
                          let durationMinutes = 45;
                          if (pickupEstimatedDepTime && dropoffEstimatedArrTime) {
                            const diffMs = new Date(dropoffEstimatedArrTime).getTime() - new Date(pickupEstimatedDepTime).getTime();
                            durationMinutes = Math.max(1, Math.round(diffMs / 60000));
                          } else if (currentRoute?.estimatedDurationMinutes) {
                            durationMinutes = currentRoute.estimatedDurationMinutes;
                          }

                          const lockedCount = trip.lockedSeats ? trip.lockedSeats.length : 0;
                          const seatsLeft = trip.availableSeats - trip.bookedSeats - lockedCount;

                          const isTargetDate = !date || (() => {
                            const y = depTime.getFullYear();
                            const m = String(depTime.getMonth() + 1).padStart(2, '0');
                            const d = String(depTime.getDate()).padStart(2, '0');
                            return `${y}-${m}-${d}` === date;
                          })();

                          return (
                            <div 
                              key={trip._id} 
                              className={`trip-card glass animate-fade-in-up ${activeTripId === trip._id ? 'connector-glow' : ''} ${!isTargetDate ? 'alternative-trip-card' : ''}`}
                              onClick={() => setActiveTripId(trip._id)}
                              style={{ 
                                animationDelay: `${idx * 0.1}s`, 
                                display: 'flex', 
                                flexDirection: 'column',
                                border: activeTripId === trip._id 
                                  ? '1px solid var(--primary)' 
                                  : isTargetDate 
                                    ? '1px solid var(--border)' 
                                    : '1px solid rgba(255, 255, 255, 0.05)',
                                position: 'relative',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                              }}
                            >
                              <div style={{ display: 'flex', width: '100%', position: 'relative' }} className="trip-card-main-row">
                                {/* Ticket Punch Cutout Top */}
                                <div style={{
                                  position: 'absolute',
                                  top: '-11px',
                                  right: '170px',
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  background: 'var(--background)',
                                  border: activeTripId === trip._id 
                                    ? '1px solid var(--primary)' 
                                    : '1px solid var(--border)',
                                  zIndex: 5
                                }} className="ticket-punch-cutout ticket-cutout-top" />
                                {/* Ticket Punch Cutout Bottom */}
                                <div style={{
                                  position: 'absolute',
                                  bottom: '-11px',
                                  right: '170px',
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  background: 'var(--background)',
                                  border: activeTripId === trip._id 
                                    ? '1px solid var(--primary)' 
                                    : '1px solid var(--border)',
                                  zIndex: 5
                                }} className="ticket-punch-cutout ticket-cutout-bottom" />

                                {/* Left Column: Premium Route Cover Landscape Banner */}
                                <div style={{
                                  width: '180px',
                                  minWidth: '180px',
                                  backgroundImage: `url("${cleanGoogleDriveLink(currentRoute?.coverImage) || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80'}")`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                  position: 'relative',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'flex-end',
                                  padding: '1.5rem'
                                }} className="trip-card-cover-hidden">
                                  <div style={{
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.9) 20%, rgba(0,0,0,0.3) 100%)',
                                    zIndex: 1
                                  }} />
                                  <div style={{ zIndex: 2, position: 'relative' }}>
                                    <span style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '1px' }}>
                                      {t('activeShuttle')}
                                    </span>
                                    <h4 style={{ margin: '4px 0 0 0', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 800 }}>
                                      {isRtl ? (currentRoute?.nameAr || currentRoute?.name || 'الوجهة') : (currentRoute?.name || 'Destination')}
                                    </h4>
                                  </div>
                                </div>

                                {/* Middle Column: Trip Timings & walking badge */}
                                <div className="trip-card-left" style={{ flex: 1, padding: '1.5rem 1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
                                  {/* Trip Date Badge container */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                                    <div style={{ 
                                      display: 'inline-flex', 
                                      alignItems: 'center', 
                                      gap: '4px', 
                                      fontSize: '0.75rem', 
                                      fontWeight: 700, 
                                      color: 'var(--primary)', 
                                      background: 'rgba(245, 183, 49, 0.08)',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      width: 'fit-content'
                                    }}>
                                      <span>📅</span>
                                      <span>{boardingDate.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                    </div>
                                    {!isTargetDate && (
                                      <span style={{ 
                                        fontSize: '0.65rem', 
                                        fontWeight: 700, 
                                        color: 'var(--text-muted)',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                      }}>
                                        {t('alternativeDate')}
                                      </span>
                                    )}
                                  </div>

                                  <div className="trip-timings-row">
                                    <div className="trip-time-block">
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 650, marginBottom: '2px' }}>
                                        {pickupDateStr}
                                      </span>
                                      <span className="trip-time" style={{ fontSize: '1.3rem', fontWeight: 800 }}>{pickupTimeStr}</span>
                                      <span className="trip-location" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {isRtl ? (pickupCp?.nameAr || pickupCp?.name || t('boardingStop')) : (pickupCp?.name || t('boardingStop'))}
                                      </span>
                                    </div>
                                    
                                    <div className="trip-timeline" style={{ margin: '0 0.75rem' }}>
                                      <span className="trip-duration">{durationMinutes} min</span>
                                      <div className="timeline-dot"></div>
                                      <div className="timeline-line"></div>
                                      <div className="timeline-dot"></div>
                                    </div>
                                    
                                    <div className="trip-time-block" style={{ alignItems: 'flex-end', textAlign: 'right' }}>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 650, marginBottom: '2px' }}>
                                        {dropoffDateStr}
                                      </span>
                                      <span className="trip-time" style={{ fontSize: '1.3rem', fontWeight: 800 }}>{dropoffTimeStr}</span>
                                      <span className="trip-location" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {isRtl ? (dropoffCp?.nameAr || dropoffCp?.name || t('dropoffStop')) : (dropoffCp?.name || t('dropoffStop'))}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {/* Static Non-Selective Checkpoints Timeline inside the Card */}
                                  {isSmartMode && trip.totalWalkingDistance !== undefined ? (
                                    (() => {
                                      const searchPickupLat = pickupLat ? parseFloat(pickupLat) : null;
                                      const searchPickupLng = pickupLng ? parseFloat(pickupLng) : null;

                                      const pickupDist = (() => {
                                        const coords = pickupCp.location?.coordinates || pickupCp.coordinates;
                                        if (coords && coords.length >= 2) {
                                          if (userLocation) {
                                            return haversineDistance(userLocation.lng, userLocation.lat, coords[0], coords[1]);
                                          }
                                          if (searchPickupLat !== null && !isNaN(searchPickupLat) && searchPickupLng !== null && !isNaN(searchPickupLng)) {
                                            return haversineDistance(searchPickupLng, searchPickupLat, coords[0], coords[1]);
                                          }
                                        }
                                        return trip.pickupCheckpoint.distanceMeters || 0;
                                      })();
                                      
                                      const firstMileTimeWalk = pickupDist > 0 ? Math.max(1, Math.round(pickupDist / 80)) : 0;
                                      const firstMileTimeCar = pickupDist > 0 ? Math.max(1, Math.round(pickupDist / 350)) : 0;

                                      const formatMinsCompact = (mins: number) => {
                                        if (mins === 0) return isRtl ? '0 د' : '0m';
                                        if (mins < 60) return isRtl ? `${mins} د` : `${mins}m`;
                                        const hrs = Math.floor(mins / 60);
                                        const remainingMins = mins % 60;
                                        return remainingMins > 0 
                                          ? (isRtl ? `${hrs} س ${remainingMins} د` : `${hrs}h ${remainingMins}m`) 
                                          : (isRtl ? `${hrs} س` : `${hrs}h`);
                                      };

                                      const distanceStr = pickupDist < 1000 
                                        ? `${pickupDist}m` 
                                        : `${(pickupDist / 1000).toFixed(1)} km`;

                                      const showLocationPrompt = !userLocation;

                                      return (
                                        <div style={{
                                          display: 'flex',
                                          justifyContent: 'center',
                                          alignItems: 'center',
                                          width: '100%',
                                          marginTop: '0.75rem'
                                        }}>
                                          {showLocationPrompt ? (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                requestGPS();
                                              }}
                                              style={{
                                                fontSize: '0.72rem',
                                                background: 'rgba(245, 183, 49, 0.06)',
                                                color: 'var(--primary)',
                                                padding: '6px 14px',
                                                borderRadius: '20px',
                                                border: '1px solid rgba(245, 183, 49, 0.35)',
                                                fontWeight: 650,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px',
                                                textAlign: 'center',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                outline: 'none'
                                              }}
                                              onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(245, 183, 49, 0.12)';
                                                e.currentTarget.style.border = '1px solid var(--primary)';
                                              }}
                                              onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(245, 183, 49, 0.06)';
                                                e.currentTarget.style.border = '1px solid rgba(245, 183, 49, 0.35)';
                                              }}
                                            >
                                              <span>📍</span>
                                              <span>
                                                {isRtl 
                                                  ? 'مشاركة موقعك لمعرفة مسافة ووقت المشي للمحطة' 
                                                  : 'Share location for walking & driving times'}
                                              </span>
                                            </button>
                                          ) : (
                                            <div style={{
                                              fontSize: '0.72rem',
                                              background: 'rgba(255, 255, 255, 0.02)',
                                              color: 'var(--primary)',
                                              padding: '6px 14px',
                                              borderRadius: '20px',
                                              border: '1px solid rgba(245, 183, 49, 0.25)',
                                              fontWeight: 650,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              gap: '8px',
                                              textAlign: 'center',
                                              flexWrap: 'wrap'
                                            }}>
                                              <span>
                                                {isRtl ? '📍 محطة الركوب:' : '📍 Pickup Stop:'}
                                              </span>
                                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                🚶 {formatMinsCompact(firstMileTimeWalk)} ({distanceStr})
                                              </span>
                                              <span style={{ color: 'rgba(255, 255, 255, 0.15)' }}>|</span>
                                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                🚗 {formatMinsCompact(firstMileTimeCar)}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    (() => {
                                      const pickupIdx = routeCps.findIndex((cp: any) => cp.name === pickupCp?.name);
                                      const dropoffIdx = routeCps.findIndex((cp: any) => cp.name === dropoffCp?.name);
                                      const startIdx = pickupIdx >= 0 ? pickupIdx : 0;
                                      const endIdx = dropoffIdx >= 0 ? dropoffIdx : routeCps.length - 1;
                                      const journeyCps = routeCps.slice(startIdx, endIdx + 1);
                                      
                                      return journeyCps.length > 0 ? (
                                        <ul className="ant-timeline ant-timeline-horizontal" style={{ margin: '1.25rem 0 0.5rem 0', padding: 0, listStyle: 'none' }}>
                                          {journeyCps.map((cp: any) => {
                                            const cpEstimatedTime = cp.minutesFromStart !== undefined
                                              ? new Date(baseTripDepTime + cp.minutesFromStart * 60 * 1000)
                                              : null;
                                            const cpTimeStr = cpEstimatedTime
                                              ? cpEstimatedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                              : '';

                                            return (
                                              <li key={cp.name} className="ant-timeline-item">
                                                <div className="ant-timeline-item-tail"></div>
                                                <div className="ant-timeline-item-head"></div>
                                                <div className="ant-timeline-item-content">
                                                  <div className="ant-timeline-item-title">
                                                    {isRtl ? (cp.nameAr || cp.name) : cp.name}
                                                  </div>
                                                  <div className="ant-timeline-item-time">
                                                    {cpTimeStr}
                                                  </div>
                                                </div>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      ) : null;
                                    })()
                                  )}
                                </div>

                                {/* Dashed Perforated Separator Line */}
                                <div className="trip-card-divider" style={{ margin: '0.75rem 0', width: '2px', borderLeft: '2px dashed var(--border)', zIndex: 1 }}></div>

                                {/* Right Column: Pricing & Booking */}
                                <div className="trip-card-right" style={{ padding: '1.5rem 1.25rem', minWidth: '180px', width: '180px', flex: '0 0 180px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                  <div className="trip-price-seats-group" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div className="trip-price" style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                                      {dynamicLegPrice} <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{isRtl ? 'ج.م' : 'EGP'}</span>
                                    </div>
                                    <div className="trip-seats" style={{ fontSize: '0.8rem', color: seatsLeft <= 5 ? 'var(--danger)' : 'var(--success)' }}>
                                      <span className="seat-icon">💺</span> {t('seatsLeft', { count: seatsLeft })}
                                    </div>
                                  </div>
                                  <div className="trip-amenities" style={{ margin: '6px 0' }}>
                                    <span title="Air Conditioned">❄️</span>
                                    <span title="Free WiFi">📶</span>
                                    <span title="USB Charging">🔌</span>
                                  </div>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const selectedCp = selectedCheckpoints[trip._id];
                                      const selectedDropoffCp = selectedDropoffCheckpoints[trip._id];
                                      const cpQuery = selectedCp ? `&checkpointName=${encodeURIComponent(selectedCp)}` : '';
                                      const dropoffQuery = selectedDropoffCp ? `&dropoffCheckpointName=${encodeURIComponent(selectedDropoffCp)}` : '';
                                      navigate(`/checkout?tripId=${trip._id}${cpQuery}${dropoffQuery}&passengers=${passengers}`);
                                    }}
                                    className="auth-button" 
                                    style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem', fontSize: '0.85rem', minHeight: '36px' }}
                                  >
                                    {t('bookSeatTicket')}
                                  </button>
                                </div>
                              </div>


                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Map Column Removed */}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
