import { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { tripsAPI, routesAPI } from '../services/api';
import logo from '../assets/d-ride-logo.jpeg';

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

const getRelativeDateLabel = (groupDateStr: string, targetDateStr?: string) => {
  const [y, m, d] = groupDateStr.split('-').map(Number);
  const groupDate = new Date(y, m - 1, d);
  
  const formatted = groupDate.toLocaleDateString(undefined, { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });

  if (!targetDateStr) return formatted;
  if (groupDateStr === targetDateStr) return `🎯 ${formatted} (Selected Date)`;

  const [ty, tm, td] = targetDateStr.split('-').map(Number);
  const targetDate = new Date(ty, tm - 1, td);
  
  const diffTime = groupDate.getTime() - targetDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === -1) return `📅 ${formatted} (Yesterday)`;
  if (diffDays === 1) return `📅 ${formatted} (Tomorrow)`;
  if (diffDays < 0) return `📅 ${formatted} (${Math.abs(diffDays)} Days Before)`;
  return `📅 ${formatted} (${diffDays} Days After)`;
};

// Map configurations removed

export default function TripSearchPage() {
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
    if (!date) return 'Next 5 Days';
    const [year, month, day] = date.split('-').map(Number);
    const parsedDate = new Date(year, month - 1, day);
    return parsedDate.toLocaleDateString(undefined, { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }, [date]);

  const [route, setRoute] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCheckpoints, setSelectedCheckpoints] = useState<Record<string, string>>({});
  const [selectedDropoffCheckpoints, setSelectedDropoffCheckpoints] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState<'earliest' | 'cheapest' | 'walks'>('earliest');

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
        dropoffCity
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
              const seatsLeft = t.availableSeats - t.bookedSeats;
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
            const seatsLeft = t.availableSeats - t.bookedSeats;
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
          tripsData.forEach((trip: any) => {
            initialSelections[trip._id] = defaultCp;
          });
          setSelectedCheckpoints(initialSelections);
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
          <h2>No Search Parameters</h2>
          <p>Please go back and select a route or enter your location to search for trips.</p>
          <button onClick={() => navigate('/')} className="btn-primary" style={{ marginTop: '1rem' }}>Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page" style={{ alignItems: 'flex-start', paddingTop: '4rem', paddingBottom: '4rem' }}>
      <div style={{ maxWidth: '950px', width: '100%', margin: '0 auto', padding: '0 1.5rem' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }} className="animate-fade-in-up">
          <Link to="/">
            <img src={logo} alt="D-Ride" className="auth-logo" />
          </Link>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Available Trips
          </h1>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {isSmartMode ? (
              <div style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem', background: 'var(--surface-hover)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--border)' }}>
                <span>📍</span>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Smart Search: Pickups & Dropoffs within 5km
                </span>
              </div>
            ) : route && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface-hover)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-2xl)', border: '1px solid var(--border)' }}>
                <span>📍</span>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{route.name}</span>
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
            <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Searching for the best rides...</p>
          </div>
        ) : sortedTrips.length === 0 ? (
          <div className="glass" style={{ textAlign: 'center', padding: '4rem 2rem', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>No trips found</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>We couldn't find any scheduled trips for the selected dates.</p>
            <button onClick={() => navigate('/')} className="btn-primary">Search Another Route</button>
          </div>
        ) : (
          <div>
            {/* Sorting Tabs & Date Selector */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1.5rem',
              width: '100%',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              {/* Sorting Tabs */}
              <div style={{ 
                display: 'flex', 
                gap: '0.75rem', 
                background: 'var(--surface-elevated)',
                padding: '6px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                maxWidth: 'fit-content'
              }}>
                <button 
                  onClick={() => setSortBy('earliest')}
                  style={{
                    padding: '0.5rem 1.2rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: sortBy === 'earliest' ? 'var(--primary)' : 'transparent',
                    color: sortBy === 'earliest' ? 'var(--text-on-primary)' : 'var(--text-secondary)',
                    transition: 'var(--transition-base)'
                  }}
                >
                  🕒 Earliest
                </button>
                <button 
                  onClick={() => setSortBy('cheapest')}
                  style={{
                    padding: '0.5rem 1.2rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: sortBy === 'cheapest' ? 'var(--primary)' : 'transparent',
                    color: sortBy === 'cheapest' ? 'var(--text-on-primary)' : 'var(--text-secondary)',
                    transition: 'var(--transition-base)'
                  }}
                >
                  💰 Cheapest
                </button>
                {isSmartMode && (
                  <button 
                    onClick={() => setSortBy('walks')}
                    style={{
                      padding: '0.5rem 1.2rem',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: sortBy === 'walks' ? 'var(--primary)' : 'transparent',
                      color: sortBy === 'walks' ? 'var(--text-on-primary)' : 'var(--text-secondary)',
                      transition: 'var(--transition-base)'
                    }}
                  >
                    🚶 Fewest Walks
                  </button>
                )}
              </div>

              {/* Date Input Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Date:</span>
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
                    fontWeight: 700,
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
                          const pickupCp = routeCps.find((cp: any) => cp.name === selectedPickupCpName) || trip.pickupCheckpoint;
                          const dropoffCp = routeCps.find((cp: any) => cp.name === selectedDropoffCpName) || trip.dropoffCheckpoint;

                          // Resolve estimated departure time (boarding time)
                          const pickupEstimatedDepTime = pickupCp?.localizedDepartureTime || pickupCp?.estimatedDepartureTime || (pickupCp?.minutesFromStart !== undefined
                            ? new Date(baseTripDepTime + pickupCp.minutesFromStart * 60 * 1000).toISOString()
                            : undefined);

                          // Resolve estimated arrival time (destination arrival time)
                          const dropoffEstimatedArrTime = dropoffCp?.localizedArrivalTime || dropoffCp?.estimatedArrivalTime || (dropoffCp?.minutesFromStart !== undefined
                            ? new Date(baseTripDepTime + dropoffCp.minutesFromStart * 60 * 1000).toISOString()
                            : undefined);

                          const depTime = pickupEstimatedDepTime ? new Date(pickupEstimatedDepTime) : new Date(trip.departureTime);
                          const arrTime = dropoffEstimatedArrTime ? new Date(dropoffEstimatedArrTime) : new Date(depTime.getTime() + 45 * 60000);
                          
                          let durationMinutes = 45;
                          if (pickupEstimatedDepTime && dropoffEstimatedArrTime) {
                            const diffMs = new Date(dropoffEstimatedArrTime).getTime() - new Date(pickupEstimatedDepTime).getTime();
                            durationMinutes = Math.max(1, Math.round(diffMs / 60000));
                          } else if (currentRoute?.estimatedDurationMinutes) {
                            durationMinutes = currentRoute.estimatedDurationMinutes;
                          }

                          const seatsLeft = trip.availableSeats - trip.bookedSeats;

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
                              onMouseEnter={() => setActiveTripId(trip._id)}
                              style={{ 
                                animationDelay: `${idx * 0.1}s`, 
                                display: 'flex', 
                                flexDirection: 'column',
                                borderRadius: '16px', 
                                overflow: 'hidden', 
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
                                }} />
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
                                }} />

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
                                      Active Shuttle
                                    </span>
                                    <h4 style={{ margin: '4px 0 0 0', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 800 }}>
                                      {currentRoute?.name || 'Destination'}
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
                                      <span>{depTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
                                        Alternative Date
                                      </span>
                                    )}
                                  </div>

                                  <div style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                                    <div className="trip-time-block">
                                      <span className="trip-time" style={{ fontSize: '1.3rem', fontWeight: 800 }}>{depTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                      <span className="trip-location" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {pickupCp?.name || 'Boarding Stop'}
                                      </span>
                                    </div>
                                    
                                    <div className="trip-timeline" style={{ margin: '0 0.75rem' }}>
                                      <span className="trip-duration">{durationMinutes} min</span>
                                      <div className="timeline-dot"></div>
                                      <div className="timeline-line"></div>
                                      <div className="timeline-dot"></div>
                                    </div>
                                    
                                    <div className="trip-time-block" style={{ alignItems: 'flex-end', textAlign: 'right' }}>
                                      <span className="trip-time" style={{ fontSize: '1.3rem', fontWeight: 800 }}>{arrTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                      <span className="trip-location" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {dropoffCp?.name || 'Dropoff Stop'}
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
                                      gap: '4px'
                                    }}>
                                      🚶 Walks: {trip.totalWalkingDistance}m total ({trip.pickupCheckpoint.distanceMeters}m to pickup · {trip.dropoffCheckpoint.distanceMeters}m from dropoff)
                                    </div>
                                  )}
                                </div>

                                {/* Dashed Perforated Separator Line */}
                                <div className="trip-card-divider" style={{ margin: '0.75rem 0', width: '2px', borderLeft: '2px dashed var(--border)', zIndex: 1 }}></div>

                                {/* Right Column: Pricing & Booking */}
                                <div className="trip-card-right" style={{ padding: '1.5rem 1.25rem', minWidth: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                  <div className="trip-price" style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                                    {trip.amountEGP ?? trip.localizedPriceEGP ?? trip.priceEGP} <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>EGP</span>
                                  </div>
                                  <div className="trip-seats" style={{ fontSize: '0.8rem', color: seatsLeft <= 5 ? 'var(--danger)' : 'var(--success)' }}>
                                    <span className="seat-icon">💺</span> {seatsLeft} seats left
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
                                    Book Seat 🎟️
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
                                  gap: '0.5rem'
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
                                      📍 Route Stops (Select stops)
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
                                          Pickup: {selectedCheckpoints[trip._id]}
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
                                          Dropoff: {selectedDropoffCheckpoints[trip._id]}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Checkpoint Stepper Progress bar */}
                                  <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    position: 'relative', 
                                    margin: '0.75rem 0 0.25rem 0',
                                    overflowX: 'auto',
                                    paddingBottom: '0.5rem',
                                    scrollbarWidth: 'none',
                                    msOverflowStyle: 'none'
                                  }} className="checkpoint-scrollbar">
                                    {/* Connecting Line */}
                                    <div style={{ 
                                      position: 'absolute', 
                                      top: '12px', 
                                      left: `${100 / (currentRoute.checkpoints.length * 2)}%`, 
                                      right: `${100 / (currentRoute.checkpoints.length * 2)}%`, 
                                      height: '4px', 
                                      background: 'var(--border)', 
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
                                            top: '12px', 
                                            left: `calc(${startPercent}% + ${100 / (checkpoints.length * 2)}% - ${startPercent / 100 * (100 / checkpoints.length)}%)`, 
                                            width: `calc(${widthPercent}% - ${(widthPercent) / 100 * (100 / checkpoints.length)}%)`,
                                            height: '4px', 
                                            background: 'var(--primary)', 
                                            zIndex: 0,
                                            transition: 'all 0.3s ease'
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
                                      
                                      let dotBg = 'var(--surface-hover)';
                                      let dotBorder = '3px solid var(--border)';
                                      let dotShadow = 'none';
                                      
                                      if (isPickup) {
                                        dotBg = 'var(--primary)';
                                        dotBorder = '4px solid var(--surface)';
                                        dotShadow = '0 0 15px var(--primary)';
                                      } else if (isDropoff) {
                                        dotBg = '#EF4444';
                                        dotBorder = '4px solid var(--surface)';
                                        dotShadow = '0 0 15px #EF4444';
                                      } else if (isActiveRoute) {
                                        dotBg = 'rgba(245, 183, 49, 0.2)';
                                        dotBorder = '3px solid var(--primary)';
                                      }

                                      // Calculate segment price delta relative to currently selected pickup & dropoff
                                      const currentPickupPrice = pickupIdx >= 0 ? (currentRoute.checkpoints[pickupIdx].priceFromStartEGP || 0) : 0;
                                      const currentDropoffPrice = dropoffIdx >= 0 ? (currentRoute.checkpoints[dropoffIdx].priceFromStartEGP || 0) : 0;
                                      const currentPrice = currentDropoffPrice - currentPickupPrice;

                                      let priceDeltaLabel = '';
                                      if (cpIdx !== pickupIdx && cpIdx !== dropoffIdx) {
                                        if (cpIdx < dropoffIdx) {
                                          // If selected as pickup
                                          const nextPickupPrice = cp.priceFromStartEGP || 0;
                                          const nextPrice = currentDropoffPrice - nextPickupPrice;
                                          const delta = nextPrice - currentPrice;
                                          if (delta !== 0) {
                                            priceDeltaLabel = delta > 0 ? `+${delta} EGP` : `${delta} EGP`;
                                          }
                                        } else if (cpIdx > pickupIdx) {
                                          // If selected as dropoff
                                          const nextDropoffPrice = cp.priceFromStartEGP || 0;
                                          const nextPrice = nextDropoffPrice - currentPickupPrice;
                                          const delta = nextPrice - currentPrice;
                                          if (delta !== 0) {
                                            priceDeltaLabel = delta > 0 ? `+${delta} EGP` : `${delta} EGP`;
                                          }
                                        }
                                      }
                                      
                                      return (
                                        <div 
                                          key={cp.name} 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (cpIdx < dropoffIdx) {
                                              setSelectedCheckpoints(prev => ({
                                                ...prev,
                                                [trip._id]: cp.name
                                              }));
                                            } else if (cpIdx > pickupIdx) {
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
                                            minWidth: '100px',
                                            zIndex: 1, 
                                            position: 'relative', 
                                            cursor: 'pointer',
                                            transition: 'transform 0.2s'
                                          }}
                                          className="checkpoint-step"
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
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            background: dotBg,
                                            border: dotBorder,
                                            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: dotShadow,
                                          }}>
                                            {(isPickup || isDropoff) && (
                                              <div style={{
                                                width: '6px',
                                                height: '6px',
                                                borderRadius: '50%',
                                                background: 'var(--text-on-primary)'
                                              }} />
                                            )}
                                          </div>
                                          
                                          <span style={{ 
                                            fontSize: '0.75rem', 
                                            fontWeight: (isPickup || isDropoff) ? 800 : 500, 
                                            color: isPickup ? 'var(--primary)' : (isDropoff ? '#EF4444' : 'var(--text-primary)'), 
                                            marginTop: '6px', 
                                            textAlign: 'center',
                                            transition: 'all 0.2s'
                                          }}>
                                            {cp.name}
                                          </span>
                                          {cp.nameAr && (
                                            <span style={{ 
                                              fontSize: '0.65rem', 
                                              color: isPickup ? 'var(--primary-hover)' : (isDropoff ? '#F87171' : 'var(--text-muted)'),
                                              textAlign: 'center',
                                              transition: 'all 0.2s'
                                            }}>
                                              {cp.nameAr}
                                            </span>
                                          )}

                                          {priceDeltaLabel && (
                                            <span style={{
                                              fontSize: '0.65rem',
                                              fontWeight: 'bold',
                                              color: priceDeltaLabel.startsWith('+') ? 'var(--danger)' : 'var(--success)',
                                              background: priceDeltaLabel.startsWith('+') ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                                              padding: '1px 4px',
                                              borderRadius: '3px',
                                              marginTop: '2px',
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
