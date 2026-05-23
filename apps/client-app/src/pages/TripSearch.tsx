import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { tripsAPI, routesAPI } from '../services/api';
import logo from '../assets/d-ride-logo.jpeg';

export default function TripSearchPage() {
  const [searchParams] = useSearchParams();
  const routeId = searchParams.get('routeId');
  const pickupLat = searchParams.get('pickupLat');
  const pickupLng = searchParams.get('pickupLng');
  const dropoffLat = searchParams.get('dropoffLat');
  const dropoffLng = searchParams.get('dropoffLng');
  const date = searchParams.get('date') || undefined;
  const passengers = searchParams.get('passengers') ? parseInt(searchParams.get('passengers')!, 10) : 1;

  const navigate = useNavigate();

  const [route, setRoute] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCheckpoints, setSelectedCheckpoints] = useState<Record<string, string>>({});
  const [selectedDropoffCheckpoints, setSelectedDropoffCheckpoints] = useState<Record<string, string>>({});

  const isSmartMode = useMemo(() => {
    return !!(pickupLat && pickupLng && dropoffLat && dropoffLng);
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  useEffect(() => {
    setLoading(true);

    if (isSmartMode) {
      routesAPI.smartSearch(
        parseFloat(pickupLat!),
        parseFloat(pickupLng!),
        parseFloat(dropoffLat!),
        parseFloat(dropoffLng!)
      )
        .then(async (smartRoutes: any[]) => {
          // smartRoutes is list of { route, pickupCheckpoint, dropoffCheckpoint, totalWalkingDistance }
          const tripPromises = smartRoutes.map((sr) =>
            tripsAPI.search(sr.route._id || sr.route.id, date)
              .then((tripsData) =>
                tripsData.map((trip: any) => ({
                  ...trip,
                  route: sr.route,
                  pickupCheckpoint: sr.pickupCheckpoint,
                  dropoffCheckpoint: sr.dropoffCheckpoint,
                  totalWalkingDistance: sr.totalWalkingDistance,
                }))
              )
              .catch(() => [])
          );

          const nestedTrips = await Promise.all(tripPromises);
          let allTrips = nestedTrips.flat();

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
      Promise.all([
        routesAPI.getAll().then(res => res.find((r: any) => r._id === routeId)),
        tripsAPI.search(routeId, date)
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
  }, [routeId, pickupLat, pickupLng, dropoffLat, dropoffLng, date, passengers, isSmartMode]);

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
        </div>

        {/* Results */}
        {loading ? (
          <div className="glass" style={{ textAlign: 'center', padding: '3rem', borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem' }}>
            <div className="app-loading-spinner"></div>
            <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Searching for the best rides...</p>
          </div>
        ) : trips.length === 0 ? (
          <div className="glass" style={{ textAlign: 'center', padding: '4rem 2rem', borderRadius: 'var(--radius-xl)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>No trips found</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>We couldn't find any scheduled trips for this route right now.</p>
            <button onClick={() => navigate('/')} className="btn-primary">Search Another Route</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {trips.map((trip, idx) => {
              const depTime = new Date(trip.departureTime);
              // Mock arrival time (e.g., 45 minutes later)
              const arrTime = new Date(depTime.getTime() + 45 * 60000);
              const seatsLeft = trip.availableSeats - trip.bookedSeats;
              const currentRoute = isSmartMode ? trip.route : route;

              return (
                <div 
                  key={trip._id} 
                  className="trip-card glass animate-fade-in-up" 
                  style={{ 
                    animationDelay: `${idx * 0.1}s`, 
                    display: 'flex', 
                    flexDirection: 'column',
                    borderRadius: '16px', 
                    overflow: 'hidden', 
                    border: '1px solid var(--border)',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', width: '100%' }} className="trip-card-main-row">
                    {/* Left Column: Premium Route Cover Landscape Banner */}
                    <div style={{
                      width: '240px',
                      minWidth: '240px',
                      backgroundImage: `url(${currentRoute?.coverImage || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80'})`,
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
                        <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '1px' }}>
                          Active Shuttle
                        </span>
                        <h4 style={{ margin: '4px 0 0 0', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 800 }}>
                          {currentRoute?.name || 'Destination'}
                        </h4>
                      </div>
                    </div>

                    {/* Middle Column: Trip Timings & walking badge */}
                    <div className="trip-card-left" style={{ flex: 1, padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
                      <div style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                        <div className="trip-time-block">
                          <span className="trip-time">{depTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="trip-location">Departure</span>
                        </div>
                        
                        <div className="trip-timeline" style={{ margin: '0 1rem' }}>
                          <span className="trip-duration">45 min</span>
                          <div className="timeline-dot"></div>
                          <div className="timeline-line"></div>
                          <div className="timeline-dot"></div>
                        </div>

                        <div className="trip-time-block" style={{ alignItems: 'flex-end', textAlign: 'right' }}>
                          <span className="trip-time">{arrTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="trip-location">Arrival</span>
                        </div>
                      </div>

                      {isSmartMode && trip.totalWalkingDistance !== undefined && (
                        <div style={{
                          marginTop: '1rem',
                          fontSize: '0.72rem',
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

                    <div className="trip-card-divider" style={{ margin: '1.5rem 0' }}></div>

                    {/* Right Column: Pricing & Booking */}
                    <div className="trip-card-right" style={{ padding: '2rem 1.5rem', minWidth: '220px' }}>
                      <div className="trip-price">{trip.priceEGP} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>EGP</span></div>
                      <div className="trip-seats" style={{ color: seatsLeft <= 5 ? 'var(--danger)' : 'var(--success)' }}>
                        <span className="seat-icon">💺</span> {seatsLeft} seats left
                      </div>
                      <div className="trip-amenities">
                        <span title="Air Conditioned">❄️</span>
                        <span title="Free WiFi">📶</span>
                        <span title="USB Charging">🔌</span>
                      </div>
                      <button 
                        onClick={() => {
                          const selectedCp = selectedCheckpoints[trip._id];
                          const selectedDropoffCp = selectedDropoffCheckpoints[trip._id];
                          const cpQuery = selectedCp ? `&checkpointName=${encodeURIComponent(selectedCp)}` : '';
                          const dropoffQuery = selectedDropoffCp ? `&dropoffCheckpointName=${encodeURIComponent(selectedDropoffCp)}` : '';
                          navigate(`/checkout?tripId=${trip._id}${cpQuery}${dropoffQuery}&passengers=${passengers}`);
                        }}
                        className="auth-button" 
                        style={{ width: '100%', padding: '0.6rem', marginTop: '0.5rem', fontSize: '0.9rem' }}
                      >
                        Book Seat 🎟️
                      </button>
                    </div>
                  </div>

                  {/* Bottom Part: Interactive Checkpoints Timeline */}
                  {currentRoute?.checkpoints && currentRoute.checkpoints.length > 0 && (
                    <div style={{ 
                      padding: '1.25rem 1.5rem', 
                      background: 'rgba(255, 255, 255, 0.02)', 
                      borderTop: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem'
                      }}>
                        <span style={{ 
                          fontSize: '0.8rem', 
                          fontWeight: 700, 
                          textTransform: 'uppercase', 
                          color: 'var(--text-secondary)',
                          letterSpacing: '0.05em',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          📍 Route Stops & Boarding Progress (Select stops)
                        </span>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {selectedCheckpoints[trip._id] && (
                            <span style={{ 
                              fontSize: '0.78rem', 
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
                              fontSize: '0.78rem', 
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
                        margin: '1rem 0 0.5rem 0',
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
                          
                          return (
                            <div 
                              key={cp.name} 
                              onClick={() => {
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
                              <div style={{
                                width: '26px',
                                height: '26px',
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
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: 'var(--text-on-primary)'
                                  }} />
                                )}
                              </div>
                              
                              <span style={{ 
                                fontSize: '0.78rem', 
                                fontWeight: (isPickup || isDropoff) ? 800 : 500, 
                                color: isPickup ? 'var(--primary)' : (isDropoff ? '#EF4444' : 'var(--text-primary)'), 
                                marginTop: '8px', 
                                textAlign: 'center',
                                transition: 'all 0.2s'
                              }}>
                                {cp.name}
                              </span>
                              {cp.nameAr && (
                                <span style={{ 
                                  fontSize: '0.68rem', 
                                  color: isPickup ? 'var(--primary-hover)' : (isDropoff ? '#F87171' : 'var(--text-muted)'),
                                  textAlign: 'center',
                                  transition: 'all 0.2s'
                                }}>
                                  {cp.nameAr}
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
        )}
      </div>
    </div>
  );
}
