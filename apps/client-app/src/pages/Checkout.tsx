import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import api, { bookingsAPI, routesAPI } from '../services/api';
import logo from '../assets/d-ride-logo.jpeg';
import { Briefcase, Settings, LayoutGrid, User, ArrowRightToLine, Lock, Bus } from 'lucide-react';

import { MapContainer, TileLayer, Marker, Polyline, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Define custom markers to bypass broken Leaflet default icon issues in bundler/test runtimes
const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [32, 52],
  iconAnchor: [16, 52],
  popupAnchor: [1, -44],
  shadowSize: [52, 52],
  className: 'p-3 touch-manipulation'
});

const goldIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [32, 52],
  iconAnchor: [16, 52],
  popupAnchor: [1, -44],
  shadowSize: [52, 52],
  className: 'p-3 touch-manipulation'
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [32, 52],
  iconAnchor: [16, 52],
  popupAnchor: [1, -44],
  shadowSize: [52, 52],
  className: 'p-3 touch-manipulation'
});

function MapFocusController({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.flyTo(coords, 14, { animate: true, duration: 1.2 });
    }
  }, [coords, map]);
  return null;
}

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get('tripId');
  const passengersParam = searchParams.get('passengers');
  const requiredSeatsCount = passengersParam ? Math.max(1, parseInt(passengersParam, 10)) : 1;
  const navigate = useNavigate();

  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [occupiedSeats, setOccupiedSeats] = useState<number[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  
  const [selectedPickupCheckpoint, setSelectedPickupCheckpoint] = useState<any>(null);
  const [selectedDropoffCheckpoint, setSelectedDropoffCheckpoint] = useState<any>(null);
  const [mapFocusCoords, setMapFocusCoords] = useState<[number, number] | null>(null);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);

  const cairoTransitHubs = [
    { name: 'Ramses Station', nameAr: 'محطة رمسيس', lat: 30.0626, lng: 31.2468 },
    { name: 'Tahrir Square', nameAr: 'ميدان التحرير', lat: 30.0444, lng: 31.2357 },
    { name: 'Heliopolis', nameAr: 'مصر الجديدة', lat: 30.0984, lng: 31.3301 },
    { name: 'Giza Square', nameAr: 'ميدان الجيزة', lat: 30.0131, lng: 31.2089 },
    { name: 'Maadi', nameAr: 'المعادي', lat: 29.9602, lng: 31.2569 },
    { name: 'New Cairo / 5th Settlement', nameAr: 'التجمع الخامس', lat: 30.0074, lng: 31.4913 },
  ];

  const handleTransitHubSelect = (hub: typeof cairoTransitHubs[0], type: 'pickup' | 'dropoff') => {
    const checkpoints = trip?.routeId?.checkpoints || [];
    let closestCp = checkpoints[0];
    let minDistance = Infinity;
    
    checkpoints.forEach((cp: any) => {
      const cpCoords = cp.location.coordinates;
      const dist = Math.sqrt(
        Math.pow(cpCoords[1] - hub.lat, 2) + Math.pow(cpCoords[0] - hub.lng, 2)
      );
      if (dist < minDistance) {
        minDistance = dist;
        closestCp = cp;
      }
    });

    if (type === 'pickup') {
      setSelectedPickupCheckpoint(closestCp || hub);
    } else {
      setSelectedDropoffCheckpoint(closestCp || hub);
    }
  };

  useEffect(() => {
    if (!tripId) return;
    
    setLoading(true);
    const cpName = searchParams.get('checkpointName');
    const dropoffCpName = searchParams.get('dropoffCheckpointName');
    const query = new URLSearchParams();
    if (cpName) query.set('pickupCheckpointName', cpName);
    if (dropoffCpName) query.set('dropoffCheckpointName', dropoffCpName);

    api.get(`/trips/${tripId}?${query.toString()}`)
      .then(data => setTrip(data))
      .catch(console.error)
      .finally(() => setLoading(false));

    bookingsAPI.getOccupiedSeats(tripId)
      .then(seats => setOccupiedSeats(seats))
      .catch(console.error);

  }, [tripId, searchParams]);


  useEffect(() => {
    if (!trip || !trip.routeId) return;

    // Check if checkpointName or dropoffCheckpointName is passed in search parameters (from search page)
    const checkpointName = searchParams.get('checkpointName');
    const dropoffCheckpointName = searchParams.get('dropoffCheckpointName');

    const checkpoints = trip.routeId.checkpoints || [];

    if (checkpointName) {
      const match = checkpoints.find((cp: any) => cp.name === checkpointName);
      if (match) {
        setSelectedPickupCheckpoint(match);
        setMapFocusCoords([match.location.coordinates[1], match.location.coordinates[0]]);
      }
    }
    if (dropoffCheckpointName) {
      const match = checkpoints.find((cp: any) => cp.name === dropoffCheckpointName);
      if (match) {
        setSelectedDropoffCheckpoint(match);
        if (!checkpointName) {
          setMapFocusCoords([match.location.coordinates[1], match.location.coordinates[0]]);
        }
      }
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
                  setMapFocusCoords([cp.location.coordinates[1], cp.location.coordinates[0]]);
                } else if (checkpoints.length > 0) {
                  setSelectedPickupCheckpoint(checkpoints[0]);
                  setMapFocusCoords([checkpoints[0].location.coordinates[1], checkpoints[0].location.coordinates[0]]);
                }
              })
              .catch(err => {
                console.error(err);
                if (checkpoints.length > 0) {
                  setSelectedPickupCheckpoint(checkpoints[0]);
                  setMapFocusCoords([checkpoints[0].location.coordinates[1], checkpoints[0].location.coordinates[0]]);
                }
              });
          }
        },
        (error) => {
          console.log("Geolocation error or denied:", error);
          if (!checkpointName && checkpoints.length > 0) {
            setSelectedPickupCheckpoint(checkpoints[0]);
            setMapFocusCoords([checkpoints[0].location.coordinates[1], checkpoints[0].location.coordinates[0]]);
          }
        }
      );
    } else {
      if (!checkpointName && checkpoints.length > 0) {
        setSelectedPickupCheckpoint(checkpoints[0]);
        setMapFocusCoords([checkpoints[0].location.coordinates[1], checkpoints[0].location.coordinates[0]]);
      }
    }

    // Default dropoff to end if not specified
    if (!dropoffCheckpointName && checkpoints.length > 0) {
      setSelectedDropoffCheckpoint(checkpoints[checkpoints.length - 1]);
    }
  }, [trip, searchParams]);

  const handleReserve = async () => {
    if (selectedSeats.length !== requiredSeatsCount) {
      alert(`Please select exactly ${requiredSeatsCount} seat(s) to match your search request.`);
      return;
    }

    setProcessing(true);
    try {
      // Create the booking with all selected seat numbers
      const booking = await bookingsAPI.create({
        tripId: trip._id || trip.id,
        seatNumbers: selectedSeats,
        pickupStopId: selectedPickupCheckpoint?.id || selectedPickupCheckpoint?._id, 
        dropoffStopId: selectedDropoffCheckpoint?.id || selectedDropoffCheckpoint?._id, 
        pickupCheckpoint: selectedPickupCheckpoint || undefined,
        dropoffCheckpoint: selectedDropoffCheckpoint || undefined,
      });

      // Redirect to the payment checkout page
      navigate(`/payment?bookingId=${booking._id || booking.id}`);
    } catch (error) {
      alert('Reservation failed: ' + ((error as any)?.message || 'Unknown error'));
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
    
    setSelectedSeats(prev => {
      const isAlreadySelected = prev.includes(num);
      if (isAlreadySelected) {
        return prev.filter(s => s !== num);
      } else {
        if (prev.length >= requiredSeatsCount) {
          if (requiredSeatsCount === 1) {
            return [num];
          } else {
            return [...prev.slice(1), num];
          }
        }
        return [...prev, num];
      }
    });
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
        className="p-3 touch-manipulation"
        style={{ cursor: isLocked || isOccupied ? 'not-allowed' : 'pointer' }}
        onClick={() => {
          if (!isLocked && !isOccupied) {
            toggleSeatSelection(num);
          }
        }}
      >
        <div 
          className={className} 
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
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
      </div>
    );
  };

  const polylinePath = trip?.routeId?.path?.coordinates?.map(
    (coord: number[]) => [coord[1], coord[0]] as [number, number]
  ) || [];

  if (!tripId) return <div className="auth-page"><div className="premium-card">No trip selected.</div></div>;

  return (
    <div className="auth-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '6rem', paddingBottom: '4rem', width: '100%' }}>
      <div className="auth-container" style={{ maxWidth: '1200px', width: '100%', padding: '0 1.5rem', margin: '0 auto' }}>
        
        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <Link to="/">
            <img src={logo} alt="D-Ride" className="auth-logo" />
          </Link>
          <h1 style={{ color: 'var(--text-primary)', marginTop: '1.25rem', fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
            Toyota HiAce Seat Selection
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            Cairo Commuter Minibus Fleet (14-Seater)
          </p>
        </div>

        {/* Visual Stepper */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '3rem',
          position: 'relative',
          padding: '0 1.5rem',
          maxWidth: '600px',
          margin: '0 auto 3rem auto'
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
              boxShadow: 'none'
            }}>
              1
            </div>
            <span className="stepper-label" style={{ color: 'var(--text-primary)' }}>Configure Commute</span>
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
            <span className="stepper-label" style={{ color: selectedSeats.length > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>Select Payment</span>
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
            <span className="stepper-label" style={{ color: processing ? 'var(--text-primary)' : 'var(--text-muted)' }}>Confirm Seat</span>
          </div>
        </div>

        {loading ? (
          <div className="premium-card" style={{ textAlign: 'center', padding: '4rem' }}>
            <div style={{ animation: 'pulse 1.5s infinite', display: 'flex', justifyContent: 'center' }}>
              <Bus size={48} color="var(--text-secondary)" />
            </div>
            <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Loading trip configuration...</p>
          </div>
        ) : trip ? (
          <div className="split-layout-container">
            
            {/* Left Main Panel: Checkpoints and Seats */}
            <div className="main-panel">
              
              {/* Checkpoint Selection Map */}
              {trip.routeId?.checkpoints && trip.routeId.checkpoints.length > 0 && (
                <div className="premium-card">
                  <div className="premium-card-title">
                    <span>📍</span> Boarding & Dropoff Checkpoints
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
                      Verify or select where the driver should pick you up and drop you off. Click markers or dots to adjust.
                    </p>
                    <button 
                      type="button" 
                      onClick={() => setMapLoadFailed(prev => !prev)}
                      style={{ fontSize: '11px', background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', flexShrink: 0 }}
                    >
                      {mapLoadFailed ? 'Show Map' : 'Select Manually'}
                    </button>
                  </div>

                  {mapLoadFailed && (
                    <div style={{
                      background: '#1c1c1e',
                      border: '1px solid var(--primary)',
                      padding: '1.25rem',
                      borderRadius: '12px',
                      marginBottom: '1.5rem',
                      fontSize: '0.88rem',
                      color: 'var(--text-primary)'
                    }}>
                      💡 <strong>Manual Selection Fallback</strong>: Select primary Cairo transit hubs below to map them to your route stops:
                      
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>Manual Pickup Hub</label>
                          <select 
                            onChange={(e) => {
                              const hub = cairoTransitHubs.find(h => h.name === e.target.value);
                              if (hub) handleTransitHubSelect(hub, 'pickup');
                            }}
                            style={{ width: '100%', padding: '10px', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem' }}
                          >
                            <option value="">Select Pickup</option>
                            {cairoTransitHubs.map(h => (
                              <option key={h.name} value={h.name}>{h.name} ({h.nameAr})</option>
                            ))}
                          </select>
                        </div>

                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>Manual Dropoff Hub</label>
                          <select 
                            onChange={(e) => {
                              const hub = cairoTransitHubs.find(h => h.name === e.target.value);
                              if (hub) handleTransitHubSelect(hub, 'dropoff');
                            }}
                            style={{ width: '100%', padding: '10px', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem' }}
                          >
                            <option value="">Select Dropoff</option>
                            {cairoTransitHubs.map(h => (
                              <option key={h.name} value={h.name}>{h.name} ({h.nameAr})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ height: '260px', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border)', zIndex: 1, marginBottom: '1.5rem', display: mapLoadFailed ? 'none' : 'block' }}>
                    <MapContainer center={polylinePath[0] || [30.0444, 31.2357]} zoom={11} style={{ height: '100%', width: '100%' }}>
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        eventHandlers={{
                          tileerror: () => {
                            setMapLoadFailed(true);
                          }
                        }}
                      />
                      <MapFocusController coords={mapFocusCoords} />
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
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setSelectedPickupCheckpoint(cp); 
                                    setMapFocusCoords([cp.location.coordinates[1], cp.location.coordinates[0]]);
                                  }}
                                  style={{ fontSize: '11px', padding: '6px 12px', background: 'var(--primary)', color: 'black', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                  Set Pickup
                                </button>
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setSelectedDropoffCheckpoint(cp); 
                                    setMapFocusCoords([cp.location.coordinates[1], cp.location.coordinates[0]]);
                                  }}
                                  style={{ fontSize: '11px', padding: '6px 12px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
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
                    paddingBottom: '0.75rem',
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
                        dotShadow = 'none';
                      } else if (isDropoff) {
                        dotBg = '#EF4444';
                        dotBorder = '4px solid var(--surface)';
                        dotShadow = 'none';
                      } else if (isActiveRoute) {
                        dotBg = '#2b2b2b';
                        dotBorder = '3px solid var(--primary)';
                      }
                      
                      return (
                        <div 
                          key={cpIdx} 
                          onClick={() => {
                            let updated = false;
                            if (cpIdx < dropoffIdx) {
                              setSelectedPickupCheckpoint(cp);
                              updated = true;
                            } else if (cpIdx > pickupIdx) {
                              setSelectedDropoffCheckpoint(cp);
                              updated = true;
                            }
                            if (updated) {
                              setMapFocusCoords([cp.location.coordinates[1], cp.location.coordinates[0]]);
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
                </div>
              )}

              {/* Interactive Minibus Grid */}
              <div className="premium-card">
                <div className="premium-card-title">
                  <span>💺</span> Toyota HiAce Cabin Layout
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Click available seats to select them. Locked seats are reserved for luggage.
                  </p>
                  <span style={{ fontSize: '11px', background: 'var(--surface-hover)', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Toyota HiAce L2H2
                  </span>
                </div>

                <div 
                  className={selectedSeats.length === requiredSeatsCount ? 'success-box-opaque' : 'warning-box-opaque'}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '2rem',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    fontSize: '0.88rem',
                    fontWeight: 600
                  }}
                >
                  <span>Requested Seats:</span>
                  <span>{selectedSeats.length} of {requiredSeatsCount} Selected</span>
                </div>

                <div className="bus-cabin" style={{ margin: '0 auto', maxWidth: '300px' }}>
                  {/* Windshield */}
                  <div className="bus-windshield windshield-opaque" style={{ height: '14px', borderRadius: '10px 10px 2px 2px', marginBottom: '1.25rem' }} />
                  
                  {/* HiAce Dashboard */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                    <span title="Steering Wheel" style={{ opacity: 0.6 }}><Settings size={18} /></span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700 }}>Dashboard</span>
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

                  {/* Sliding Entry Door */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '4px 0 12px 0' }}>
                    <div className="door-entry-opaque" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: 'var(--primary)', padding: '3px 8px', borderRadius: '4px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                <div className="seat-legend" style={{ display: 'flex', justifyContent: 'space-around', marginTop: '2.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <div className="legend-dot" style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--border)' }}></div>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Available</span>
                  </div>
                  <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <div className="legend-dot" style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--primary)' }}></div>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Selected</span>
                  </div>
                  <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <div className="legend-dot" style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--surface-hover)', border: '1px solid var(--border)' }}></div>
                    <span style={{ color: 'var(--text-secondary)', opacity: 0.5, fontWeight: 500 }}>Occupied</span>
                  </div>
                  <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <span style={{ display: 'flex', alignItems: 'center' }}><Briefcase size={14} /></span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Luggage</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Sticky Sidebar Panel: Summary and Reservation Actions */}
            <div className="sidebar-panel">
              
              {/* Booking Summary Card */}
              <div className="premium-card">
                <div className="premium-card-title">
                  <span>📋</span> Commute Details
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Line Route</div>
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.1rem', marginTop: '2px' }}>
                      {trip.routeId?.name || 'Standard Route'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                      {selectedPickupCheckpoint?.estimatedDepartureTime || selectedPickupCheckpoint?.minutesFromStart !== undefined ? 'Estimated Boarding Time' : 'Departure Time'}
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem', marginTop: '2px' }}>
                      {(() => {
                        const baseTime = new Date(trip.departureTime).getTime();
                        const timeToUse = selectedPickupCheckpoint?.estimatedDepartureTime 
                          ? new Date(selectedPickupCheckpoint.estimatedDepartureTime)
                          : (selectedPickupCheckpoint?.minutesFromStart !== undefined
                              ? new Date(baseTime + selectedPickupCheckpoint.minutesFromStart * 60000)
                              : new Date(trip.departureTime));
                        
                        return timeToUse.toLocaleString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                      })()}
                    </div>
                  </div>

                  {/* Route Checkpoints Details */}
                  <div className="checkpoint-timeline" style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                    <div className="checkpoint-timeline-item pickup">
                      <div className="checkpoint-timeline-dot" />
                      <span className="checkpoint-timeline-label">Selected Pickup</span>
                      <span className="checkpoint-timeline-value">{selectedPickupCheckpoint?.name || 'Not Selected'}</span>
                      {selectedPickupCheckpoint?.nameAr && (
                        <span className="checkpoint-timeline-value-ar">{selectedPickupCheckpoint.nameAr}</span>
                      )}
                    </div>
                    
                    <div className="checkpoint-timeline-item dropoff">
                      <div className="checkpoint-timeline-dot" />
                      <span className="checkpoint-timeline-label">Selected Dropoff</span>
                      <span className="checkpoint-timeline-value">{selectedDropoffCheckpoint?.name || 'Not Selected'}</span>
                      {selectedDropoffCheckpoint?.nameAr && (
                        <span className="checkpoint-timeline-value-ar">{selectedDropoffCheckpoint.nameAr}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Reactive Seat details card */}
              {selectedSeats.length > 0 && (
                <div className="premium-card premium-card-solid-amber">
                  <div className="premium-card-title" style={{ borderBottomColor: '#f5b731', color: 'var(--primary)' }}>
                    <span>🎫</span> Selected Slots
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '1rem' }}>
                    {selectedSeats.map(num => (
                      <span key={num} style={{
                        background: 'var(--primary)',
                        color: 'var(--text-on-primary)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        Seat #{num}
                      </span>
                    ))}
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                    {selectedSeats.length === 1 
                      ? getSeatLabel(selectedSeats[0]).desc
                      : "Booking multiple spaces in a single transaction. All boarding passes will be dispatched simultaneously!"
                    }
                  </p>
                </div>
              )}

              {/* Invoice breakdown card */}
              <div className="premium-card">
                <div className="premium-card-title">
                  <span>🧾</span> Invoice Breakdown
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Selected Slots ({selectedSeats.length})</span>
                    <span style={{ fontWeight: 'bold', color: selectedSeats.length > 0 ? 'var(--primary)' : 'var(--text-primary)' }}>
                      {selectedSeats.length > 0 ? selectedSeats.map(s => `#${s}`).join(', ') : 'None'}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Base Fare</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {Math.round(trip.priceEGP * selectedSeats.length * 0.86)} EGP
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>VAT (14% Included)</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {trip.priceEGP * selectedSeats.length - Math.round(trip.priceEGP * selectedSeats.length * 0.86)} EGP
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Booking Fee</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>
                      0.00 EGP (FREE)
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Total Fare</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                      {trip.priceEGP * selectedSeats.length} EGP
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Trigger Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button 
                  onClick={handleReserve} 
                  className="auth-button" 
                  disabled={
                    processing || 
                    selectedSeats.length !== requiredSeatsCount
                  }
                  style={{ padding: '1rem' }}
                >
                  {processing 
                    ? 'Reserving Seats...' 
                    : selectedSeats.length !== requiredSeatsCount
                      ? `Select exactly ${requiredSeatsCount} seat(s)`
                      : 'Confirm & Proceed to Payment'
                  }
                </button>
                
                <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', textAlign: 'center', margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <Lock size={12} /> Seats will be temporarily held for 10 minutes.
                </p>
              </div>

            </div>

          </div>
        ) : (
          <div className="premium-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Trip configuration not found.</p>
            <button onClick={() => navigate('/')} className="btn-primary" style={{ marginTop: '1.5rem' }}>Return to Home</button>
          </div>
        )}
      </div>
    </div>
  );
}
