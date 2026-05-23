import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { tripsAPI, routesAPI } from '../services/api';
import logo from '../assets/d-ride-logo.jpeg';

export default function TripSearchPage() {
  const [searchParams] = useSearchParams();
  const routeId = searchParams.get('routeId');
  const navigate = useNavigate();

  const [route, setRoute] = useState<any>(null);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCheckpoints, setSelectedCheckpoints] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!routeId) return;
    
    setLoading(true);
    Promise.all([
      routesAPI.getAll().then(res => res.find((r: any) => r._id === routeId)),
      tripsAPI.search(routeId)
    ])
    .then(([routeData, tripsData]) => {
      setRoute(routeData);
      setTrips(tripsData);

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
  }, [routeId, searchParams]);

  if (!routeId) {
    return (
      <div className="auth-page">
        <div className="auth-card glass" style={{ textAlign: 'center' }}>
          <h2>No Route Selected</h2>
          <p>Please go back and select a route to search for trips.</p>
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
          {route && (
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
                      backgroundImage: `url(${route?.coverImage || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80'})`,
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
                          {route?.name?.split('→')[1] || 'Destination'}
                        </h4>
                      </div>
                    </div>

                    {/* Middle Column: Trip Timings */}
                    <div className="trip-card-left" style={{ flex: 1, padding: '2rem 1.5rem' }}>
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
                          const cpQuery = selectedCp ? `&checkpointName=${encodeURIComponent(selectedCp)}` : '';
                          navigate(`/checkout?tripId=${trip._id}${cpQuery}`);
                        }}
                        className="auth-button" 
                        style={{ width: '100%', padding: '0.6rem', marginTop: '0.5rem', fontSize: '0.9rem' }}
                      >
                        Book Seat 🎟️
                      </button>
                    </div>
                  </div>

                  {/* Bottom Part: Swvl-style Interactive Checkpoints Timeline */}
                  {route?.checkpoints && route.checkpoints.length > 0 && (
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
                          📍 Boarding Checkpoint Timeline (Select one)
                        </span>
                        {selectedCheckpoints[trip._id] && (
                          <span style={{ 
                            fontSize: '0.8rem', 
                            fontWeight: 600, 
                            color: 'var(--primary)',
                            background: 'rgba(245, 183, 49, 0.1)',
                            padding: '2px 8px',
                            borderRadius: '6px'
                          }}>
                            Selected: {selectedCheckpoints[trip._id]}
                          </span>
                        )}
                      </div>
                      
                      {/* Checkpoint Stepper Progress bar */}
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        position: 'relative', 
                        margin: '1rem 0 0.5rem 0',
                        overflowX: 'auto',
                        paddingBottom: '0.5rem',
                        scrollbarWidth: 'none', // hide default scrollbar
                        msOverflowStyle: 'none'
                      }} className="checkpoint-scrollbar">
                        {/* Connecting Line */}
                        <div style={{ 
                          position: 'absolute', 
                          top: '12px', 
                          left: `${100 / (route.checkpoints.length * 2)}%`, 
                          right: `${100 / (route.checkpoints.length * 2)}%`, 
                          height: '4px', 
                          background: 'var(--border)', 
                          zIndex: 0 
                        }} />
                        
                        {/* Colored Active Progress Line */}
                        {(() => {
                          const selectedIdx = route.checkpoints.findIndex((cp: any) => cp.name === selectedCheckpoints[trip._id]);
                          if (selectedIdx > 0 && route.checkpoints.length > 1) {
                            const percent = (selectedIdx / (route.checkpoints.length - 1)) * 100;
                            return (
                              <div style={{ 
                                position: 'absolute', 
                                top: '12px', 
                                left: `${100 / (route.checkpoints.length * 2)}%`, 
                                width: `calc(${percent}% - ${percent / 100 * (100 / route.checkpoints.length)}%)`,
                                height: '4px', 
                                background: 'var(--primary)', 
                                zIndex: 0,
                                transition: 'all 0.3s ease'
                              }} />
                            );
                          }
                          return null;
                        })()}

                        {route.checkpoints.map((cp: any, cpIdx: number) => {
                          const isSelected = selectedCheckpoints[trip._id] === cp.name;
                          const selectedIdx = route.checkpoints.findIndex((item: any) => item.name === selectedCheckpoints[trip._id]);
                          const isPassedOrSelected = cpIdx <= selectedIdx;
                          
                          return (
                            <div 
                              key={cp.name} 
                              onClick={() => {
                                setSelectedCheckpoints(prev => ({
                                  ...prev,
                                  [trip._id]: cp.name
                                }));
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
                              {/* Pulsing indicator dot */}
                              <div style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                background: isSelected ? 'var(--primary)' : 'var(--surface-hover)',
                                border: isSelected 
                                  ? '4px solid var(--surface)' 
                                  : (isPassedOrSelected ? '3px solid var(--primary-dark)' : '3px solid var(--border)'),
                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: isSelected ? '0 0 15px var(--primary)' : 'none',
                              }}>
                                {isSelected && (
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
                                fontWeight: isSelected ? 800 : 500, 
                                color: isSelected ? 'var(--primary)' : 'var(--text-primary)', 
                                marginTop: '8px', 
                                textAlign: 'center',
                                transition: 'all 0.2s'
                              }}>
                                {cp.name}
                              </span>
                              {cp.nameAr && (
                                <span style={{ 
                                  fontSize: '0.68rem', 
                                  color: isSelected ? 'var(--primary-hover)' : 'var(--text-muted)',
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
