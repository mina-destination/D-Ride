import { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { tripsAPI, routesAPI } from '../services/api';
import { useTranslation } from '../context/LanguageContext';

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

const getRelativeDateLabel = (groupDateStr: string, targetDateStr?: string, isRtl?: boolean) => {
  const [y, m, d] = groupDateStr.split('-').map(Number);
  const groupDate = new Date(y, m - 1, d);
  
  const formatted = groupDate.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });

  if (!targetDateStr) return formatted;
  if (groupDateStr === targetDateStr) return isRtl ? `🎯 ${formatted} (التاريخ المحدد)` : `🎯 ${formatted} (Selected Date)`;

  const [ty, tm, td] = targetDateStr.split('-').map(Number);
  const targetDate = new Date(ty, tm - 1, td);
  
  const diffTime = groupDate.getTime() - targetDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === -1) return isRtl ? `📅 ${formatted} (أمس)` : `📅 ${formatted} (Yesterday)`;
  if (diffDays === 1) return isRtl ? `📅 ${formatted} (غداً)` : `📅 ${formatted} (Tomorrow)`;
  if (diffDays < 0) return isRtl ? `📅 ${formatted} (قبل ${Math.abs(diffDays)} يوم/أيام)` : `📅 ${formatted} (${Math.abs(diffDays)} Days Before)`;
  return isRtl ? `📅 ${formatted} (بعد ${diffDays} يوم/أيام)` : `📅 ${formatted} (${diffDays} Days After)`;
};

// Map configurations removed

export default function TripSearchPage() {
  const { t, isRtl } = useTranslation();
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

  const [route, setRoute] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCheckpoints, setSelectedCheckpoints] = useState<Record<string, string>>({});
  const [selectedDropoffCheckpoints, setSelectedDropoffCheckpoints] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState<'earliest' | 'cheapest' | 'walks'>('earliest');
  const [draggingTrip, setDraggingTrip] = useState<{
    tripId: string;
    type: 'pickup' | 'dropoff';
  } | null>(null);

  const handlePointerDown = (e: React.PointerEvent, tripId: string, cpIdx: number, checkpoints: any[]) => {
    // Only allow drag using mouse pointers to prevent touch devices from hijacking page/horizontal scrolling
    if (e.pointerType !== 'mouse') {
      return;
    }

    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    const pickupName = selectedCheckpoints[tripId] || checkpoints[0].name;
    const dropoffName = selectedDropoffCheckpoints[tripId] || checkpoints[checkpoints.length - 1].name;

    const pickupIdx = checkpoints.findIndex((c: any) => c.name === pickupName);
    const dropoffIdx = checkpoints.findIndex((c: any) => c.name === dropoffName);

    let type: 'pickup' | 'dropoff';
    if (cpIdx === pickupIdx) {
      type = 'pickup';
    } else if (cpIdx === dropoffIdx) {
      type = 'dropoff';
    } else if (cpIdx < pickupIdx) {
      type = 'pickup';
    } else if (cpIdx > dropoffIdx) {
      type = 'dropoff';
    } else {
      const distToPickup = cpIdx - pickupIdx;
      const distToDropoff = dropoffIdx - cpIdx;
      type = distToPickup <= distToDropoff ? 'pickup' : 'dropoff';
    }

    setDraggingTrip({ tripId, type });
  };

  const handlePointerMove = (e: React.PointerEvent, tripId: string, checkpoints: any[]) => {
    if (!draggingTrip || draggingTrip.tripId !== tripId) return;

    const container = document.getElementById(`stepper-container-${tripId}`);
    if (!container) return;

    const steps = Array.from(container.getElementsByClassName('checkpoint-step'));
    let closestIdx = -1;
    let minDiff = Infinity;

    steps.forEach((step, idx) => {
      const rect = step.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const diff = Math.abs(e.clientX - centerX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    if (closestIdx !== -1) {
      const targetCp = checkpoints[closestIdx];
      const pickupName = selectedCheckpoints[tripId] || checkpoints[0].name;
      const dropoffName = selectedDropoffCheckpoints[tripId] || checkpoints[checkpoints.length - 1].name;

      const pickupIdx = checkpoints.findIndex((c: any) => c.name === pickupName);
      const dropoffIdx = checkpoints.findIndex((c: any) => c.name === dropoffName);

      if (draggingTrip.type === 'pickup') {
        if (closestIdx < dropoffIdx && targetCp.purpose !== 'REST' && targetCp.purpose !== 'DROP_OFF') {
          setSelectedCheckpoints(prev => ({
            ...prev,
            [tripId]: targetCp.name
          }));
        }
      } else if (draggingTrip.type === 'dropoff') {
        if (closestIdx > pickupIdx && targetCp.purpose !== 'REST' && targetCp.purpose !== 'PICKUP') {
          setSelectedDropoffCheckpoints(prev => ({
            ...prev,
            [tripId]: targetCp.name
          }));
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDraggingTrip(null);
  };

  // Active trip state
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const targetRef = useRef<HTMLDivElement>(null);

  const isSmartMode = useMemo(() => {
    return !!(pickupLat && pickupLng && dropoffLat && dropoffLng);
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  const filteredTrips = useMemo(() => {
    if (!trips || trips.length === 0) return [];
    
    if (!date) {
      // Show trips for the next 5 days (today inclusive to today + 5 days exclusive)
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(start);
      end.setDate(start.getDate() + 5);
      
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
        return tripDate >= start && tripDate < end;
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
              ...sr.pickupCheckpoint,
              ...sr.trip?.pickupCheckpoint,
            },
            dropoffCheckpoint: {
              ...sr.dropoffCheckpoint,
              ...sr.trip?.dropoffCheckpoint,
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
        <div className="auth-card glass" style={{ textAlign: 'center' }}>
          <h2>{t('noSearchParameters')}</h2>
          <p>{t('noSearchParametersDesc')}</p>
          <button onClick={() => navigate('/')} className="btn-primary" style={{ marginTop: '1rem' }}>{t('backToHome')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="trip-search-page-container">
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('travelDateLabel')}:</span>
                <input 
                  type="date"
                  value={date || ''}
                  onChange={(e) => {
                    const newParams = new URLSearchParams(searchParams);
                    if (e.target.value) {
                      newParams.set('date', e.target.value);
                    } else {
                      newParams.delete('date');
                    }
                    navigate(`/search?${newParams.toString()}`);
                  }}
                  style={{
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s',
                    fontFamily: 'var(--font-family)'
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
                          {getRelativeDateLabel(group.dateKey, date)}
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
                                  top: '-10px',
                                  right: '170px',
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  background: 'var(--background)',
                                  border: '1px solid var(--border)',
                                  zIndex: 5
                                }} className="ticket-punch-cutout" />
                                {/* Ticket Punch Cutout Bottom */}
                                <div style={{
                                  position: 'absolute',
                                  bottom: '-10px',
                                  right: '170px',
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  background: 'var(--background)',
                                  border: '1px solid var(--border)',
                                  zIndex: 5
                                }} className="ticket-punch-cutout" />

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
                                      <span className="trip-time" style={{ fontSize: '1.3rem', fontWeight: 800 }}>{dropoffTimeStr}</span>
                                      <span className="trip-location" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {isRtl ? (dropoffCp?.nameAr || dropoffCp?.name || t('dropoffStop')) : (dropoffCp?.name || t('dropoffStop'))}
                                      </span>
                                    </div>
                                  </div>

                                  {isSmartMode && trip.totalWalkingDistance !== undefined && (
                                    <div style={{
                                      marginTop: '0.75rem',
                                      fontSize: '0.7rem',
                                      background: 'rgba(245, 183, 49, 0.06)',
                                      color: 'var(--primary)',
                                      padding: '4px 10px',
                                      borderRadius: '8px',
                                      border: '1px solid rgba(245, 183, 49, 0.15)',
                                      fontWeight: 600,
                                      alignSelf: 'center',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      flexWrap: 'wrap',
                                      whiteSpace: 'normal',
                                      wordBreak: 'break-word',
                                      textAlign: 'center',
                                      justifyContent: 'center',
                                      maxWidth: '100%',
                                      boxSizing: 'border-box'
                                    }}>
                                      🚶 {t('walksTotal', { total: trip.totalWalkingDistance, pickup: trip.pickupCheckpoint.distanceMeters, dropoff: trip.dropoffCheckpoint.distanceMeters })}
                                    </div>
                                  )}
                                </div>

                                {/* Dashed Perforated Separator Line */}
                                <div className="trip-card-divider" style={{ margin: '0.75rem 0', width: '2px', borderLeft: '2px dashed var(--border)', zIndex: 1 }}></div>

                                {/* Right Column: Pricing & Booking */}
                                <div className="trip-card-right" style={{ padding: '1.5rem 1.25rem', minWidth: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                  <div className="trip-price" style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                                    {dynamicLegPrice} <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{isRtl ? 'ج.م' : 'EGP'}</span>
                                  </div>
                                  <div className="trip-seats" style={{ fontSize: '0.8rem', color: seatsLeft <= 5 ? 'var(--danger)' : 'var(--success)' }}>
                                    <span className="seat-icon">💺</span> {t('seatsLeft', { count: seatsLeft })}
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

                              {/* Bottom Part: Interactive Checkpoints Timeline */}
                              {currentRoute?.checkpoints && currentRoute.checkpoints.length > 0 && (
                                <div style={{ 
                                  padding: '1rem 1.25rem', 
                                  background: 'rgba(255, 255, 255, 0.02)', 
                                  borderTop: '1px solid var(--border)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.5rem',
                                  width: '100%',
                                  maxWidth: '100%',
                                  boxSizing: 'border-box',
                                  overflow: 'hidden'
                                }}>
                                  <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '0.5rem'
                                  }}>
                                    <span style={{ 
                                      fontSize: '0.75rem', 
                                      fontWeight: 700, 
                                      textTransform: 'uppercase', 
                                      color: 'var(--text-secondary)',
                                      letterSpacing: '0.05em',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px'
                                    }}>
                                      📍 {t('routeStopsSelect')}
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                      {selectedCheckpoints[trip._id] && (
                                        <span style={{ 
                                          fontSize: '0.72rem', 
                                          fontWeight: 600, 
                                          color: 'var(--primary)',
                                          background: 'rgba(245, 183, 49, 0.1)',
                                          padding: '2px 8px',
                                          borderRadius: '6px'
                                        }}>
                                          {t('pickup')}: {isRtl ? (routeCps.find((item: any) => item.name === selectedCheckpoints[trip._id])?.nameAr || selectedCheckpoints[trip._id]) : selectedCheckpoints[trip._id]}
                                        </span>
                                      )}
                                      {selectedDropoffCheckpoints[trip._id] && (
                                        <span style={{ 
                                          fontSize: '0.72rem', 
                                          fontWeight: 600, 
                                          color: '#EF4444',
                                          background: 'rgba(239, 68, 68, 0.1)',
                                          padding: '2px 8px',
                                          borderRadius: '6px'
                                        }}>
                                          {t('dropoff')}: {isRtl ? (routeCps.find((item: any) => item.name === selectedDropoffCheckpoints[trip._id])?.nameAr || selectedDropoffCheckpoints[trip._id]) : selectedDropoffCheckpoints[trip._id]}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Checkpoint Stepper Progress bar */}
                                  <div 
                                    id={`stepper-container-${trip._id}`}
                                    style={{ 
                                      display: 'flex', 
                                      alignItems: 'flex-start', 
                                      position: 'relative', 
                                      margin: '1.5rem 0 1rem 0',
                                      overflowX: 'auto',
                                      paddingBottom: '1rem',
                                      scrollbarWidth: 'none',
                                      msOverflowStyle: 'none',
                                      zIndex: 2,
                                      background: 'rgba(255, 255, 255, 0.01)',
                                      padding: '1.25rem 0.5rem 1rem 0.5rem',
                                      borderRadius: '12px',
                                      border: '1px solid rgba(255, 255, 255, 0.03)',
                                      userSelect: draggingTrip && draggingTrip.tripId === trip._id ? 'none' : 'auto',
                                      width: '100%',
                                      maxWidth: '100%',
                                      boxSizing: 'border-box'
                                    }} 
                                    className="checkpoint-scrollbar"
                                  >
                                    <style>{`
                                      @keyframes pulse-pickup {
                                        0% { box-shadow: 0 0 0 0 rgba(245, 183, 49, 0.4); }
                                        70% { box-shadow: 0 0 0 10px rgba(245, 183, 49, 0); }
                                        100% { box-shadow: 0 0 0 0 rgba(245, 183, 49, 0); }
                                      }
                                      @keyframes pulse-dropoff {
                                        0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                                        70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                                        100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                                      }
                                      .checkpoint-scrollbar::-webkit-scrollbar {
                                        display: none;
                                      }
                                      .checkpoint-item {
                                        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                                      }
                                      .checkpoint-item:hover {
                                        transform: translateY(-2px);
                                      }
                                      .checkpoint-item:hover .checkpoint-dot-pulse {
                                        transform: scale(1.15);
                                      }
                                    `}</style>

                                    {/* Connecting Line (Inactive Background) */}
                                    <div style={{ 
                                      position: 'absolute', 
                                      top: '48px', 
                                      left: `${100 / (currentRoute.checkpoints.length * 2)}%`, 
                                      right: `${100 / (currentRoute.checkpoints.length * 2)}%`, 
                                      height: '5px', 
                                      background: 'rgba(255,255,255,0.08)', 
                                      borderRadius: '4px',
                                      zIndex: 0 
                                    }} />
                                    
                                    {/* Colored Active Progress Line */}
                                    {(() => {
                                      const checkpoints = currentRoute.checkpoints || [];
                                      if (checkpoints.length < 2) return null;
                                      
                                      const pickupName = selectedCheckpoints[trip._id];
                                      const dropoffName = selectedDropoffCheckpoints[trip._id];
                                      
                                      const pickupIdx = checkpoints.findIndex((cp: any) => cp.name === pickupName);
                                      const dropoffIdx = dropoffName 
                                        ? checkpoints.findIndex((cp: any) => cp.name === dropoffName)
                                        : checkpoints.length - 1;
                                        
                                      if (pickupIdx >= 0 && dropoffIdx >= pickupIdx) {
                                        const startPercent = (pickupIdx / (checkpoints.length - 1)) * 100;
                                        const endPercent = (dropoffIdx / (checkpoints.length - 1)) * 100;
                                        const widthPercent = endPercent - startPercent;
                                        
                                        return (
                                          <div style={{ 
                                            position: 'absolute', 
                                            top: '48px', 
                                            left: `calc(${startPercent}% + ${100 / (checkpoints.length * 2)}% - ${startPercent / 100 * (100 / checkpoints.length)}%)`, 
                                            width: `calc(${widthPercent}% - ${(widthPercent) / 100 * (100 / checkpoints.length)}%)`,
                                            height: '5px', 
                                            background: 'linear-gradient(90deg, var(--primary) 0%, #EF4444 100%)', 
                                            borderRadius: '4px',
                                            boxShadow: '0 0 10px rgba(245, 183, 49, 0.25)',
                                            zIndex: 0,
                                            transition: draggingTrip && draggingTrip.tripId === trip._id ? 'none' : 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                                          }} />
                                        );
                                      }
                                      return null;
                                    })()}

                                    {currentRoute.checkpoints.map((cp: any, cpIdx: number) => {
                                      const isPickup = selectedCheckpoints[trip._id] === cp.name;
                                      const isDropoff = selectedDropoffCheckpoints[trip._id] === cp.name;
                                      
                                      const pickupIdx = currentRoute.checkpoints.findIndex((item: any) => item.name === selectedCheckpoints[trip._id]);
                                      const dropoffIdx = selectedDropoffCheckpoints[trip._id] 
                                        ? currentRoute.checkpoints.findIndex((item: any) => item.name === selectedDropoffCheckpoints[trip._id])
                                        : currentRoute.checkpoints.length - 1;
                                        
                                      const isActiveRoute = cpIdx >= pickupIdx && cpIdx <= dropoffIdx;
                                      
                                      let dotBg: string;
                                      let dotBorder: string;
                                      let dotShadow = 'none';
                                      let dotSize: string;
                                      let dotInnerSize: string;
                                      let dotInnerBg = 'transparent';
                                      let animName = 'none';
                                      
                                      if (isPickup) {
                                        dotBg = 'var(--primary)';
                                        dotBorder = '4px solid #1a1a1a';
                                        dotSize = '28px';
                                        dotInnerSize = '8px';
                                        dotInnerBg = '#000';
                                        animName = 'pulse-pickup 1.8s infinite';
                                        dotShadow = '0 0 15px rgba(245, 183, 49, 0.4)';
                                      } else if (isDropoff) {
                                        dotBg = '#EF4444';
                                        dotBorder = '4px solid #1a1a1a';
                                        dotSize = '28px';
                                        dotInnerSize = '8px';
                                        dotInnerBg = '#fff';
                                        animName = 'pulse-dropoff 1.8s infinite';
                                        dotShadow = '0 0 15px rgba(239, 68, 68, 0.4)';
                                      } else if (isActiveRoute) {
                                        dotBg = '#1c1c1e';
                                        dotBorder = '3px solid var(--primary)';
                                        dotSize = '20px';
                                        dotInnerSize = '6px';
                                        dotInnerBg = 'var(--primary)';
                                      } else {
                                        if (cp.purpose === 'REST') {
                                          dotBg = '#242426';
                                          dotBorder = '2px dashed rgba(239, 68, 68, 0.4)';
                                          dotSize = '16px';
                                          dotInnerSize = '4px';
                                        } else {
                                          dotBg = '#141416';
                                          dotBorder = '2px solid rgba(255,255,255,0.08)';
                                          dotSize = '16px';
                                          dotInnerSize = '4px';
                                        }
                                      }

                                      const getPriceBetween = (pIdx: number, dIdx: number) => {
                                        if (pIdx < 0 || dIdx < 0 || pIdx >= dIdx) return 0;
                                        const pCp = currentRoute.checkpoints[pIdx];
                                        const dCp = currentRoute.checkpoints[dIdx];
                                        if (pCp.prices && pCp.prices[dCp.name] !== undefined) {
                                          return Number(pCp.prices[dCp.name]);
                                        }
                                        return (dCp.priceFromStartEGP || 0) - (pCp.priceFromStartEGP || 0);
                                      };

                                      const currentPrice = getPriceBetween(pickupIdx, dropoffIdx);

                                      let priceDeltaLabel = '';
                                      if (cpIdx !== pickupIdx && cpIdx !== dropoffIdx) {
                                        if (cpIdx < dropoffIdx) {
                                          const nextPrice = getPriceBetween(cpIdx, dropoffIdx);
                                          const delta = nextPrice - currentPrice;
                                          if (delta !== 0) {
                                            priceDeltaLabel = delta > 0 ? `+${delta} EGP` : `${delta} EGP`;
                                          }
                                        } else if (cpIdx > pickupIdx) {
                                          const nextPrice = getPriceBetween(pickupIdx, cpIdx);
                                          const delta = nextPrice - currentPrice;
                                          if (delta !== 0) {
                                            priceDeltaLabel = delta > 0 ? `+${delta} EGP` : `${delta} EGP`;
                                          }
                                        }
                                      }
                                      
                                      return (
                                        <div 
                                          key={cp.name}
                                          onPointerDown={(e) => handlePointerDown(e, trip._id, cpIdx, currentRoute.checkpoints)}
                                          onPointerMove={(e) => handlePointerMove(e, trip._id, currentRoute.checkpoints)}
                                          onPointerUp={handlePointerUp}
                                          onPointerCancel={handlePointerUp}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (cp.purpose === 'REST') return;

                                            let targetType: 'pickup' | 'dropoff';
                                            if (cpIdx === pickupIdx) {
                                              targetType = 'pickup';
                                            } else if (cpIdx === dropoffIdx) {
                                              targetType = 'dropoff';
                                            } else if (cpIdx < pickupIdx) {
                                              targetType = 'pickup';
                                            } else if (cpIdx > dropoffIdx) {
                                              targetType = 'dropoff';
                                            } else {
                                              const distToPickup = cpIdx - pickupIdx;
                                              const distToDropoff = dropoffIdx - cpIdx;
                                              if (distToPickup < distToDropoff) {
                                                targetType = 'pickup';
                                              } else if (distToDropoff < distToPickup) {
                                                targetType = 'dropoff';
                                              } else {
                                                targetType = 'dropoff'; // equidistant default
                                              }
                                            }

                                            if (targetType === 'pickup') {
                                              if (cp.purpose === 'DROP_OFF') return;
                                              setSelectedCheckpoints(prev => ({
                                                ...prev,
                                                [trip._id]: cp.name
                                              }));
                                            } else {
                                              if (cp.purpose === 'PICKUP') return;
                                              setSelectedDropoffCheckpoints(prev => ({
                                                ...prev,
                                                [trip._id]: cp.name
                                              }));
                                            }
                                          }}
                                          style={{ 
                                            display: 'flex', 
                                            flexDirection: 'column', 
                                            alignItems: 'center', 
                                            flex: 1, 
                                            minWidth: '110px',
                                            zIndex: 1, 
                                            position: 'relative', 
                                            cursor: cp.purpose === 'REST' ? 'not-allowed' : (draggingTrip && draggingTrip.tripId === trip._id ? 'grabbing' : 'pointer'),
                                            opacity: cp.purpose === 'REST' ? 0.4 : 1,
                                            touchAction: draggingTrip && draggingTrip.tripId === trip._id ? 'none' : 'auto'
                                          }}
                                          className="checkpoint-step p-3 min-w-[48px] min-h-[48px] checkpoint-item"
                                        >
                                          {/* City Legend Badge */}
                                          {cp.city && (
                                            <span style={{
                                              position: 'absolute',
                                              top: '-16px',
                                              fontSize: '0.6rem',
                                              fontWeight: 800,
                                              background: 'rgba(245, 183, 49, 0.1)',
                                              color: 'var(--primary)',
                                              padding: '1px 5px',
                                              borderRadius: '4px',
                                              whiteSpace: 'nowrap',
                                              zIndex: 2,
                                              pointerEvents: 'none'
                                            }}>
                                              🏙️ {cp.city}
                                            </span>
                                          )}

                                          <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            height: '32px',
                                            width: '32px'
                                          }}>
                                            <div 
                                              className="checkpoint-dot-pulse"
                                              style={{
                                                width: dotSize,
                                                height: dotSize,
                                                borderRadius: '50%',
                                                background: dotBg,
                                                border: dotBorder,
                                                animation: animName,
                                                transition: draggingTrip && draggingTrip.tripId === trip._id ? 'none' : 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: dotShadow,
                                              }}
                                            >
                                              {dotInnerBg !== 'transparent' && (
                                                <div style={{
                                                  width: dotInnerSize,
                                                  height: dotInnerSize,
                                                  borderRadius: '50%',
                                                  background: dotInnerBg
                                                }} />
                                              )}
                                            </div>
                                          </div>
                                          
                                          <span style={{ 
                                            fontSize: '0.78rem', 
                                            fontWeight: (isPickup || isDropoff) ? 800 : 600, 
                                            color: isPickup ? 'var(--primary)' : (isDropoff ? '#EF4444' : (isActiveRoute ? 'var(--text-primary)' : 'var(--text-muted)')), 
                                            marginTop: '8px', 
                                            textAlign: 'center',
                                            transition: 'all 0.2s',
                                            letterSpacing: '-0.01em'
                                          }}>
                                            {cp.name}
                                          </span>
                                          {cp.nameAr && (
                                            <span style={{ 
                                              fontSize: '0.68rem', 
                                              fontWeight: (isPickup || isDropoff) ? 700 : 500,
                                              color: isPickup ? 'var(--primary-hover)' : (isDropoff ? '#F87171' : 'var(--text-muted)'),
                                              textAlign: 'center',
                                              marginTop: '2px',
                                              opacity: isActiveRoute ? 0.9 : 0.6,
                                              transition: 'all 0.2s'
                                            }}>
                                              {cp.nameAr}
                                            </span>
                                          )}

                                          {cp.purpose && cp.purpose !== 'BOTH' && (
                                            <span style={{
                                              fontSize: '0.65rem',
                                              fontWeight: 'bold',
                                              color: cp.purpose === 'REST' ? '#EF4444' : cp.purpose === 'DROP_OFF' ? '#F5B731' : '#3B82F6',
                                              marginTop: '4px',
                                              whiteSpace: 'nowrap'
                                            }}>
                                              {cp.purpose === 'REST' 
                                                ? (isRtl ? 'استراحة فقط' : 'Rest Only') 
                                                : cp.purpose === 'DROP_OFF' 
                                                  ? (isRtl ? 'نزول فقط' : 'Drop Only') 
                                                  : (isRtl ? 'صعود فقط' : 'Pickup Only')}
                                            </span>
                                          )}

                                          {priceDeltaLabel && (
                                            <span style={{
                                              fontSize: '0.65rem',
                                              fontWeight: 'bold',
                                              color: priceDeltaLabel.startsWith('+') ? 'var(--danger)' : 'var(--success)',
                                              background: priceDeltaLabel.startsWith('+') ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                                              padding: '2px 6px',
                                              borderRadius: '4px',
                                              marginTop: '4px',
                                              whiteSpace: 'nowrap'
                                            }}>
                                              {priceDeltaLabel}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
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
