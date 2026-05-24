import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import api, { bookingsAPI, paymobAPI, routesAPI } from '../services/api';
import logo from '../assets/d-ride-logo.jpeg';
import { Briefcase, Settings, LayoutGrid, User, ArrowRightToLine, Ticket, Lock, Bus } from 'lucide-react';

import { MapContainer, TileLayer, Marker, Polyline, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Define custom markers to bypass broken Leaflet default icon issues in bundler/test runtimes
const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const goldIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get('tripId');
  const navigate = useNavigate();

  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [occupiedSeats, setOccupiedSeats] = useState<number[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  
  const [selectedPickupCheckpoint, setSelectedPickupCheckpoint] = useState<any>(null);
  const [selectedDropoffCheckpoint, setSelectedDropoffCheckpoint] = useState<any>(null);

  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'WALLET' | 'CASH'>('CARD');
  const [walletNumber, setWalletNumber] = useState<string>('');

  useEffect(() => {
    if (!tripId) return;
    
    setLoading(true);
    api.get(`/trips/${tripId}`)
      .then(data => setTrip(data))
      .catch(console.error)
      .finally(() => setLoading(false));

    bookingsAPI.getOccupiedSeats(tripId)
      .then(seats => setOccupiedSeats(seats))
      .catch(console.error);
  }, [tripId]);

  useEffect(() => {
    if (!trip || !trip.routeId) return;

    // Check if checkpointName or dropoffCheckpointName is passed in search parameters (from search page)
    const checkpointName = searchParams.get('checkpointName');
    const dropoffCheckpointName = searchParams.get('dropoffCheckpointName');

    const checkpoints = trip.routeId.checkpoints || [];

    if (checkpointName) {
      const match = checkpoints.find((cp: any) => cp.name === checkpointName);
      if (match) setSelectedPickupCheckpoint(match);
    }
    if (dropoffCheckpointName) {
      const match = checkpoints.find((cp: any) => cp.name === dropoffCheckpointName);
      if (match) setSelectedDropoffCheckpoint(match);
    }

    // Geolocation centering and fallback
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          
          if (!checkpointName) {
            routesAPI.getNearestCheckpoint(trip.routeId._id || trip.routeId, latitude, longitude)
              .then(cp => {
                if (cp) {
                  setSelectedPickupCheckpoint(cp);
                } else if (checkpoints.length > 0) {
                  setSelectedPickupCheckpoint(checkpoints[0]);
                }
              })
              .catch(err => {
                console.error(err);
                if (checkpoints.length > 0) {
                  setSelectedPickupCheckpoint(checkpoints[0]);
                }
              });
          }
        },
        (error) => {
          console.log("Geolocation error or denied:", error);
          if (!checkpointName && checkpoints.length > 0) {
            setSelectedPickupCheckpoint(checkpoints[0]);
          }
        }
      );
    } else {
      if (!checkpointName && checkpoints.length > 0) {
        setSelectedPickupCheckpoint(checkpoints[0]);
      }
    }

    // Default dropoff to end if not specified
    if (!dropoffCheckpointName && checkpoints.length > 0) {
      setSelectedDropoffCheckpoint(checkpoints[checkpoints.length - 1]);
    }
  }, [trip, searchParams]);

  const handleCheckout = async () => {
    if (selectedSeats.length === 0) {
      alert('Please select at least one seat to proceed.');
      return;
    }

    if (paymentMethod === 'WALLET' && !walletNumber.match(/^01[0125][0-9]{8}$/)) {
      alert('Please enter a valid Egyptian mobile wallet number (e.g. 01012345678).');
      return;
    }

    setProcessing(true);
    try {
      // 1. Create the booking with all selected seat numbers
      const booking = await bookingsAPI.create({
        tripId: trip._id,
        seatNumbers: selectedSeats,
        pickupStopId: selectedPickupCheckpoint?.id || selectedPickupCheckpoint?._id, 
        dropoffStopId: selectedDropoffCheckpoint?.id || selectedDropoffCheckpoint?._id, 
        pickupCheckpoint: selectedPickupCheckpoint || undefined,
        dropoffCheckpoint: selectedDropoffCheckpoint || undefined,
      });

      // 2. Initialize Paymob Checkout
      const paymobResult = await paymobAPI.checkout({
        bookingId: booking._id,
        amountCents: trip.priceEGP * selectedSeats.length * 100, // Cost * seats count to cents
        paymentMethod,
        walletNumber: paymentMethod === 'WALLET' ? walletNumber : undefined,
      });

      // 3. Redirect to the Paymob iframe / redirect URL
      if (paymentMethod === 'CASH') {
        navigate('/my-trips');
      } else if (paymobResult.redirectUrl) {
        window.location.href = paymobResult.redirectUrl;
      } else if (paymobResult.iframeUrl) {
        window.location.href = paymobResult.iframeUrl;
      } else {
        navigate('/my-trips');
      }
    } catch (error) {
      alert('Checkout failed: ' + ((error as any)?.message || 'Unknown error'));
      setProcessing(false);
    }
  };

  const getSeatLabel = (num: number) => {
    if (num === 1) return { label: 'Front VIP Cockpit Seat ⭐', desc: 'Front-row seat with scenic dashboard views next to the driver!' };
    if ([4, 7, 10].includes(num)) return { label: 'Premium Window Seat 🪟', desc: 'Window-side seat with scenic community views.' };
    if ([11, 14].includes(num)) return { label: 'Rear Window Seat 🪟', desc: 'Comfortable window seat on the rear row.' };
    if ([2, 5, 8, 12, 13].includes(num)) return { label: 'Spacious Aisle Seat 🚶', desc: 'Easy-access seat located directly on the cabin aisle.' };
    return { label: 'Standard Cabin Seat 💺', desc: 'Comfortable mid-cabin passenger seat.' };
  };

  const toggleSeatSelection = (num: number) => {
    if (occupiedSeats.includes(num)) return;
    if (trip?.lockedSeats?.includes(num)) return; // Prevent selecting locked seat
    
    setSelectedSeats(prev => 
      prev.includes(num) ? prev.filter(s => s !== num) : [...prev, num]
    );
  };

  const renderSeat = (num: number) => {
    const isOccupied = occupiedSeats.includes(num);
    const isSelected = selectedSeats.includes(num);
    const isLocked = trip?.lockedSeats?.includes(num);
    
    let className = "bus-seat";
    if (isOccupied) className += " occupied";
    if (isSelected) className += " selected";
    if (isLocked) className += " locked-luggage";

    return (
      <div 
        key={num}
        className={className} 
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isLocked || isOccupied ? 'not-allowed' : 'pointer',
          transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
        onClick={() => {
          if (!isLocked && !isOccupied) {
            toggleSeatSelection(num);
          }
        }}
        title={isLocked ? "Luggage Hold Area (Locked by Admin)" : isOccupied ? `Seat #${num} (Occupied)` : `Seat #${num}`}
      >
        <div className="bus-seat-inner">
          {isLocked ? (
            <span style={{ display: 'flex', alignItems: 'center' }} title="Luggage Hold Area"><Briefcase size={14} /></span>
          ) : (
            <>
              {/* Premium Cushion & Stitching */}
              <div className="bus-seat-cushion" />
              <div className="bus-seat-stitching" />
              <span style={{ 
                zIndex: 2, 
                fontSize: '0.78rem', 
                fontWeight: 'bold', 
                color: isSelected ? 'black' : 'var(--text-secondary)'
              }}>
                {num}
              </span>
            </>
          )}
        </div>
      </div>
    );
  };

  const polylinePath = trip?.routeId?.path?.coordinates?.map(
    (coord: number[]) => [coord[1], coord[0]] as [number, number]
  ) || [];

  if (!tripId) return <div className="auth-page"><div className="auth-card glass">No trip selected.</div></div>;

  return (
    <div className="auth-page" style={{ alignItems: 'flex-start', paddingTop: '4rem', paddingBottom: '4rem' }}>
      <div className="auth-container" style={{ maxWidth: '600px', width: '100%', padding: '0 1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link to="/">
            <img src={logo} alt="D-Ride" className="auth-logo" />
          </Link>
          <h1 style={{ color: 'var(--text-primary)', marginTop: '1rem', fontSize: '2rem', fontWeight: 800 }}>
            Toyota HiAce Seat Selection
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Cairo Commuter Minibus Fleet (14-Seater)
          </p>
        </div>

        {/* Visual Stepper */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          position: 'relative',
          padding: '0 1.5rem'
        }}>
          {/* Progress Connecting Line */}
          <div style={{
            position: 'absolute',
            top: '35%',
            left: '15%',
            right: '15%',
            height: '2px',
            background: 'var(--border)',
            zIndex: 0,
            transform: 'translateY(-50%)'
          }} />
          <div style={{
            position: 'absolute',
            top: '35%',
            left: '15%',
            width: selectedSeats.length > 0 ? (processing ? '70%' : '35%') : '0%',
            height: '2px',
            background: 'var(--primary)',
            zIndex: 0,
            transform: 'translateY(-50%)',
            transition: 'all 0.3s ease'
          }} />

          {/* Step 1 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--primary)',
              color: 'var(--text-on-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '13px',
              border: '3px solid var(--background)',
              boxShadow: '0 0 10px rgba(245, 183, 49, 0.2)'
            }}>
              1
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px' }}>Configure Commute</span>
          </div>

          {/* Step 2 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: selectedSeats.length > 0 ? 'var(--primary)' : 'var(--surface-elevated)',
              color: selectedSeats.length > 0 ? 'var(--text-on-primary)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '13px',
              border: '3px solid var(--background)',
              transition: 'all 0.3s'
            }}>
              2
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: selectedSeats.length > 0 ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: '6px' }}>Select Payment</span>
          </div>

          {/* Step 3 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: processing ? 'var(--primary)' : 'var(--surface-elevated)',
              color: processing ? 'var(--text-on-primary)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '13px',
              border: '3px solid var(--background)',
              transition: 'all 0.3s'
            }}>
              3
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: processing ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: '6px' }}>Confirm Seat</span>
          </div>
        </div>

        {loading ? (
          <div className="auth-card glass" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ animation: 'pulse 1.5s infinite', display: 'flex', justifyContent: 'center' }}>
              <Bus size={48} color="var(--text-secondary)" />
            </div>
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading trip configuration...</p>
          </div>
        ) : trip ? (
          <div className="auth-card glass" style={{ borderRadius: '20px', padding: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 700 }}>
              Booking Summary
            </h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Route</span>
              <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{trip.routeId?.name || 'Standard Route'}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Departure</span>
              <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{new Date(trip.departureTime).toLocaleString()}</span>
            </div>

            {/* Checkpoint Selection Map */}
            {trip.routeId?.checkpoints && trip.routeId.checkpoints.length > 0 && (
              <div style={{ marginTop: '1rem', marginBottom: '1.5rem', background: 'var(--surface-elevated)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '16px' }}>
                <h4 style={{ color: 'var(--text-primary)', margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 700 }}>
                  Boarding & Dropoff Checkpoints 📍
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Verify or select where the driver should pick you up and drop you off. Click markers or stepper below to adjust.
                </p>
                <div style={{ height: '220px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', zIndex: 1, marginBottom: '1rem' }}>
                  <MapContainer center={polylinePath[0] || [30.0444, 31.2357]} zoom={11} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {polylinePath.length > 0 && (
                      <Polyline positions={polylinePath} color="var(--primary)" weight={4} opacity={0.6} />
                    )}
                    {/* User Location */}
                    {userLocation && (
                      <CircleMarker center={userLocation} radius={8} pathOptions={{ fillColor: '#3b82f6', fillOpacity: 0.8, color: 'white', weight: 2 }}>
                        <Popup>You are here</Popup>
                      </CircleMarker>
                    )}
                    {/* Checkpoints */}
                    {trip.routeId.checkpoints.map((cp: any, idx: number) => {
                      const cpCoords: [number, number] = [cp.location.coordinates[1], cp.location.coordinates[0]];
                      const isPickup = selectedPickupCheckpoint && selectedPickupCheckpoint.name === cp.name;
                      const isDropoff = selectedDropoffCheckpoint && selectedDropoffCheckpoint.name === cp.name;
                      
                      return (
                        <Marker 
                          key={idx} 
                          position={cpCoords}
                          icon={isPickup ? goldIcon : (isDropoff ? redIcon : blueIcon)}
                        >
                          <Popup>
                            <strong>{cp.name}</strong>
                            {cp.nameAr && <><br />{cp.nameAr}</>}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setSelectedPickupCheckpoint(cp); }}
                                style={{ fontSize: '10px', padding: '4px 8px', background: 'var(--primary)', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                Set Pickup
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setSelectedDropoffCheckpoint(cp); }}
                                style={{ fontSize: '10px', padding: '4px 8px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                              >
                                Set Dropoff
                              </button>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                </div>

                {/* Checkpoint Stepper Progress bar */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  position: 'relative', 
                  margin: '1.5rem 0 1rem 0',
                  overflowX: 'auto',
                  paddingBottom: '0.5rem',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  zIndex: 2
                }} className="checkpoint-scrollbar">
                  {/* Connecting Line */}
                  <div style={{ 
                    position: 'absolute', 
                    top: '12px', 
                    left: `${100 / (trip.routeId.checkpoints.length * 2)}%`, 
                    right: `${100 / (trip.routeId.checkpoints.length * 2)}%`, 
                    height: '4px', 
                    background: 'var(--border)', 
                    zIndex: 0 
                  }} />
                  
                  {/* Colored Active Progress Line */}
                  {(() => {
                    const checkpoints = trip.routeId.checkpoints || [];
                    if (checkpoints.length < 2) return null;
                    
                    const pickupIdx = selectedPickupCheckpoint 
                      ? checkpoints.findIndex((cp: any) => cp.name === selectedPickupCheckpoint.name)
                      : 0;
                    const dropoffIdx = selectedDropoffCheckpoint 
                      ? checkpoints.findIndex((cp: any) => cp.name === selectedDropoffCheckpoint.name)
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

                  {trip.routeId.checkpoints.map((cp: any, cpIdx: number) => {
                    const isPickup = selectedPickupCheckpoint && selectedPickupCheckpoint.name === cp.name;
                    const isDropoff = selectedDropoffCheckpoint && selectedDropoffCheckpoint.name === cp.name;
                    
                    const checkpoints = trip.routeId.checkpoints || [];
                    const pickupIdx = selectedPickupCheckpoint 
                      ? checkpoints.findIndex((item: any) => item.name === selectedPickupCheckpoint.name)
                      : 0;
                    const dropoffIdx = selectedDropoffCheckpoint 
                      ? checkpoints.findIndex((item: any) => item.name === selectedDropoffCheckpoint.name)
                      : checkpoints.length - 1;
                      
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
                        key={cpIdx} 
                        onClick={() => {
                          if (cpIdx < dropoffIdx) {
                            setSelectedPickupCheckpoint(cp);
                          } else if (cpIdx > pickupIdx) {
                            setSelectedDropoffCheckpoint(cp);
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
                      >
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
                      </div>
                    );
                  })}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedPickupCheckpoint && (
                    <div style={{ background: 'var(--surface-hover)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Selected Pickup</div>
                          <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{selectedPickupCheckpoint.name}</div>
                          {selectedPickupCheckpoint.nameAr && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{selectedPickupCheckpoint.nameAr}</div>}
                        </div>
                        <span style={{ fontSize: '20px' }}>📍</span>
                      </div>
                    </div>
                  )}
                  {selectedDropoffCheckpoint && (
                    <div style={{ background: 'var(--surface-hover)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Selected Dropoff</div>
                          <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{selectedDropoffCheckpoint.name}</div>
                          {selectedDropoffCheckpoint.nameAr && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{selectedDropoffCheckpoint.nameAr}</div>}
                        </div>
                        <span style={{ fontSize: '20px', color: '#EF4444' }}>🏁</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Interactive Toyota HiAce Minibus Chassis Shell */}
            <div className="seat-selector-container" style={{ marginTop: '1.5rem', background: 'var(--surface-elevated)', border: '1px solid var(--border)', padding: '2rem 1.5rem', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h4 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1rem', fontWeight: 700 }}>Select Your Seats</h4>
                <span style={{ fontSize: '11px', background: 'var(--surface-hover)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  Toyota HiAce L2H2
                </span>
              </div>

              <div className="bus-cabin" style={{ margin: '0 auto' }}>
                {/* Windshield */}
                <div className="bus-windshield" style={{ background: 'rgba(245, 183, 49, 0.08)', border: '1px solid rgba(245, 183, 49, 0.2)', height: '14px', borderRadius: '10px 10px 2px 2px', marginBottom: '1rem' }} />
                
                {/* HiAce Dashboard / Cockpit line */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                  <span title="Steering Wheel" style={{ opacity: 0.6 }}><Settings size={18} /></span>
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Dashboard</span>
                  <span title="Dashboard console" style={{ opacity: 0.5 }}><LayoutGrid size={16} /></span>
                </div>

                {/* Driver & VIP Row */}
                <div className="cabin-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div className="bus-seat driver" style={{ border: '2px dashed var(--border)', color: 'var(--text-muted)', cursor: 'not-allowed', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <User size={16} />
                  </div>
                  <div className="cabin-aisle" style={{ width: '44px' }} />
                  {renderSeat(1)}
                </div>

                {/* Sliding Entry Door Visual Break */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '4px 0 12px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '8px', color: 'var(--primary)', background: 'rgba(245,183,49,0.1)', border: '1px solid rgba(245,183,49,0.3)', padding: '2px 8px', borderRadius: '3px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <ArrowRightToLine size={10} /> Sliding door entry
                  </div>
                </div>

                {/* Row 2 */}
                <div className="cabin-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  {renderSeat(2)}
                  {renderSeat(3)}
                  <div className="cabin-aisle" style={{ width: '44px' }} />
                  {renderSeat(4)}
                </div>

                {/* Row 3 */}
                <div className="cabin-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  {renderSeat(5)}
                  {renderSeat(6)}
                  <div className="cabin-aisle" style={{ width: '44px' }} />
                  {renderSeat(7)}
                </div>

                {/* Row 4 */}
                <div className="cabin-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  {renderSeat(8)}
                  {renderSeat(9)}
                  <div className="cabin-aisle" style={{ width: '44px' }} />
                  {renderSeat(10)}
                </div>

                {/* Row 5 */}
                <div className="cabin-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  {renderSeat(11)}
                  {renderSeat(12)}
                  {renderSeat(13)}
                  {renderSeat(14)}
                </div>
              </div>

              {/* Legends */}
              <div className="seat-legend" style={{ display: 'flex', justifyContent: 'space-around', marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <div className="legend-dot" style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--border)' }}></div>
                  <span style={{ color: 'var(--text-secondary)' }}>Available</span>
                </div>
                <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <div className="legend-dot" style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary)' }}></div>
                  <span style={{ color: 'var(--text-secondary)' }}>Selected</span>
                </div>
                <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <div className="legend-dot" style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--surface-hover)', border: '1px solid var(--border)' }}></div>
                  <span style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>Occupied</span>
                </div>
                <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center' }}><Briefcase size={14} /></span>
                  <span style={{ color: 'var(--text-secondary)' }}>Luggage Hold</span>
                </div>
              </div>

              {/* High-Fidelity Reactive Seat Characteristic Cards */}
              {selectedSeats.length > 0 && (
                <div className="seat-characteristic-card">
                  <div className="seat-characteristic-card-header">
                    <span style={{ display: 'flex', alignItems: 'center' }}><Ticket size={24} color="var(--primary)" /></span>
                    <strong className="seat-characteristic-card-title">
                      Selected Slots ({selectedSeats.length} {selectedSeats.length === 1 ? 'Seat' : 'Seats'})
                    </strong>
                  </div>
                  <div className="seat-characteristic-card-slots">
                    {selectedSeats.map(num => (
                      <span key={num} className="seat-characteristic-card-slot">
                        Seat #{num}
                      </span>
                    ))}
                  </div>
                  <p className="seat-characteristic-card-desc">
                    {selectedSeats.length === 1 
                      ? getSeatLabel(selectedSeats[0]).desc
                      : "Booking multiple spaces in a single transaction. All boarding passes will be dispatched simultaneously!"
                    }
                  </p>
                </div>
              )}
            </div>

            {/* Price breakdown invoice card */}
            <div style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '1.25rem 1.5rem',
              marginTop: '2rem',
              marginBottom: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <h4 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '0.95rem', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                Invoice Breakdown 🧾
              </h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Selected Slots</span>
                <span style={{ fontWeight: 'bold', color: selectedSeats.length > 0 ? 'var(--primary)' : 'var(--text-primary)' }}>
                  {selectedSeats.length > 0 ? selectedSeats.map(s => `#${s}`).join(', ') : 'None Selected'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Base Fare</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {Math.round(trip.priceEGP * selectedSeats.length * 0.86)} EGP
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>VAT (14% Included)</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {trip.priceEGP * selectedSeats.length - Math.round(trip.priceEGP * selectedSeats.length * 0.86)} EGP
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Booking Fee</span>
                <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>
                  0.00 EGP (FREE)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Total Fare</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                  {trip.priceEGP * selectedSeats.length} EGP
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
              <h4 style={{ color: 'var(--text-primary)', margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700 }}>
                Payment Method 💳
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CARD')}
                  className={`payment-method-btn ${paymentMethod === 'CARD' ? 'active' : ''}`}
                  style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 4px', height: 'auto', minHeight: '60px' }}
                >
                  <span style={{ fontSize: '1.2rem' }}>💳</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Card / Visa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('WALLET')}
                  className={`payment-method-btn ${paymentMethod === 'WALLET' ? 'active' : ''}`}
                  style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 4px', height: 'auto', minHeight: '60px' }}
                >
                  <span style={{ fontSize: '1.2rem' }}>📱</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Mobile Wallet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`payment-method-btn ${paymentMethod === 'CASH' ? 'active' : ''}`}
                  style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 4px', height: 'auto', minHeight: '60px' }}
                >
                  <span style={{ fontSize: '1.2rem' }}>💵</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Cash on Board</span>
                </button>
              </div>

              {paymentMethod === 'WALLET' && (
                <div style={{
                  marginBottom: '1.25rem',
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                  padding: '14px',
                  borderRadius: '10px',
                  animation: 'slideDownFade 0.3s ease'
                }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                    Mobile Wallet Number (Vodafone, Orange, Etisalat Cash)
                  </label>
                  <input
                    type="text"
                    value={walletNumber}
                    onChange={(e) => setWalletNumber(e.target.value)}
                    placeholder="e.g. 01012345678"
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-hover)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      fontSize: '0.9rem'
                    }}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '6px 0 0 0' }}>
                    Standard 11-digit Egyptian mobile number.
                  </p>
                </div>
              )}

              {paymentMethod === 'CASH' && (
                <div style={{
                  marginBottom: '1.25rem',
                  background: 'rgba(245,183,49,0.05)',
                  border: '1px solid rgba(245,183,49,0.2)',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)'
                }}>
                  🤝 <strong>Cash on Board</strong>: Pay directly to the minibus driver during boarding. Ticket confirmation is instant.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Total Fare</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                {trip.priceEGP * selectedSeats.length} EGP
              </span>
            </div>

            <button 
              onClick={handleCheckout} 
              className="auth-button" 
              disabled={processing || selectedSeats.length === 0}
              style={{ marginTop: '2rem' }}
            >
              {processing 
                ? 'Processing Securely...' 
                : paymentMethod === 'CASH' 
                  ? 'Confirm Booking (Cash)' 
                  : `Pay ${trip.priceEGP * selectedSeats.length} EGP via Paymob`
              }
            </button>
            <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <Lock size={12} /> Secured via Paymob Egypt. Cards, Wallets, and Cash on Board supported.
            </p>
          </div>
        ) : (
          <div className="auth-card glass" style={{ textAlign: 'center', padding: '3rem' }}>
            <p>Trip configuration not found.</p>
            <button onClick={() => navigate('/')} className="btn-primary" style={{ marginTop: '1rem' }}>Return to Home</button>
          </div>
        )}
      </div>
    </div>
  );
}
