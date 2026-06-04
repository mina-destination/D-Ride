import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api, { bookingsAPI, routesAPI } from '../services/api';
import { Briefcase, Settings, LayoutGrid, User, ArrowRightToLine, Lock, Bus } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LanguageContext';
import SEO from '../components/SEO';

import { MapContainer, TileLayer, Marker, Polyline, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Define custom markers to bypass broken Leaflet default icon issues in bundler/test runtimes
const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [48, 78],
  iconAnchor: [24, 78],
  popupAnchor: [1, -70],
  shadowSize: [78, 78],
  className: 'p-3 touch-manipulation min-w-[48px] min-h-[48px]'
});

const goldIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [48, 78],
  iconAnchor: [24, 78],
  popupAnchor: [1, -70],
  shadowSize: [78, 78],
  className: 'p-3 touch-manipulation min-w-[48px] min-h-[48px]'
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [48, 78],
  iconAnchor: [24, 78],
  popupAnchor: [1, -70],
  shadowSize: [78, 78],
  className: 'p-3 touch-manipulation min-w-[48px] min-h-[48px]'
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
  const { theme } = useTheme();
  const { t, isRtl, language } = useTranslation();

  const isAr = language === 'ar';
  const seoTitle = isAr ? 'اختيار المقاعد والدفع | دي-رايد' : 'Select Seats & Checkout | D-Ride';
  const seoDescription = isAr
    ? 'اختر محطات الركوب والنزول وحدد مقاعدك المفضلة على مخطط كابينة حافلة تويوتا هايس التابعة لدي-رايد.'
    : 'Configure your checkpoints and select your seats in the Toyota HiAce cabin for your D-Ride commute.';

  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [occupiedSeats, setOccupiedSeats] = useState<number[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  
  const [selectedPickupCheckpoint, setSelectedPickupCheckpoint] = useState<any>(null);
  const [selectedDropoffCheckpoint, setSelectedDropoffCheckpoint] = useState<any>(null);
  const [mapFocusCoords, setMapFocusCoords] = useState<[number, number] | null>(null);

  const getLegPrice = () => {
    if (!trip) return 0;
    if (selectedPickupCheckpoint && selectedDropoffCheckpoint) {
      if (selectedPickupCheckpoint.prices && selectedPickupCheckpoint.prices[selectedDropoffCheckpoint.name] !== undefined) {
        return Number(selectedPickupCheckpoint.prices[selectedDropoffCheckpoint.name]);
      }
      const pickupPrice = Number(selectedPickupCheckpoint.priceFromStartEGP || 0);
      const dropoffPrice = Number(selectedDropoffCheckpoint.priceFromStartEGP || trip.priceEGP || 0);
      const legPrice = dropoffPrice - pickupPrice;
      if (legPrice > 0) return legPrice;
    }
    return Number(trip.priceEGP || 0);
  };

  const legPrice = getLegPrice();
  const legSubTotalFare = legPrice * selectedSeats.length;



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
  }, [tripId, searchParams]);

  useEffect(() => {
    if (!tripId) return;

    const pickupName = selectedPickupCheckpoint?.name;
    const dropoffName = selectedDropoffCheckpoint?.name;

    bookingsAPI.getOccupiedSeats(tripId, pickupName, dropoffName)
      .then(seats => {
        setOccupiedSeats(seats);
        setSelectedSeats(prev => prev.filter(s => !seats.includes(s)));
      })
      .catch(console.error);
  }, [tripId, selectedPickupCheckpoint, selectedDropoffCheckpoint]);


  useEffect(() => {
    if (!trip || !trip.routeId) return;

    // Check if checkpointName or dropoffCheckpointName is passed in search parameters (from search page)
    const checkpointName = searchParams.get('checkpointName');
    const dropoffCheckpointName = searchParams.get('dropoffCheckpointName');

    const checkpoints = trip.routeId.checkpoints || [];
    const firstValidPickup = checkpoints.find((cp: any) => cp.purpose !== 'REST' && cp.purpose !== 'DROP_OFF') || checkpoints[0];
    const lastValidDropoff = [...checkpoints].reverse().find((cp: any) => cp.purpose !== 'REST' && cp.purpose !== 'PICKUP') || checkpoints[checkpoints.length - 1];

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
                  setSelectedPickupCheckpoint(firstValidPickup);
                  setMapFocusCoords([firstValidPickup.location.coordinates[1], firstValidPickup.location.coordinates[0]]);
                }
              })
              .catch(err => {
                console.error(err);
                if (checkpoints.length > 0) {
                  setSelectedPickupCheckpoint(firstValidPickup);
                  setMapFocusCoords([firstValidPickup.location.coordinates[1], firstValidPickup.location.coordinates[0]]);
                }
              });
          }
        },
        (error) => {
          console.log("Geolocation error or denied:", error);
          if (!checkpointName && checkpoints.length > 0) {
            setSelectedPickupCheckpoint(firstValidPickup);
            setMapFocusCoords([firstValidPickup.location.coordinates[1], firstValidPickup.location.coordinates[0]]);
          }
        }
      );
    } else {
      if (!checkpointName && checkpoints.length > 0) {
        setSelectedPickupCheckpoint(firstValidPickup);
        setMapFocusCoords([firstValidPickup.location.coordinates[1], firstValidPickup.location.coordinates[0]]);
      }
    }

    // Default dropoff to end if not specified
    if (!dropoffCheckpointName && checkpoints.length > 0) {
      setSelectedDropoffCheckpoint(lastValidDropoff);
    }
  }, [trip, searchParams]);

  const handleReserve = async () => {
    if (selectedSeats.length !== requiredSeatsCount) {
      alert(t('pleaseSelectSeatsToMatch', { count: requiredSeatsCount }));
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
        pickupCheckpointId: selectedPickupCheckpoint?.id || selectedPickupCheckpoint?._id || selectedPickupCheckpoint?.name,
        dropoffCheckpointId: selectedDropoffCheckpoint?.id || selectedDropoffCheckpoint?._id || selectedDropoffCheckpoint?.name,
        pickupCheckpoint: selectedPickupCheckpoint || undefined,
        dropoffCheckpoint: selectedDropoffCheckpoint || undefined,
      });

      // Redirect to the payment checkout page
      navigate(`/payment?bookingId=${booking._id || booking.id}`);
    } catch (error) {
      alert(t('reservationFailed') + ((error as any)?.message || 'Unknown error'));
      setProcessing(false);
    }
  };

  const getSeatLabel = (num: number) => {
    if (num === 1) return { label: t('vipCockpitSeat'), desc: t('vipCockpitSeatDesc') };
    if ([4, 7, 10].includes(num)) return { label: t('premiumWindowSeat'), desc: t('premiumWindowSeatDesc') };
    if ([11, 14].includes(num)) return { label: t('rearWindowSeat'), desc: t('rearWindowSeatDesc') };
    if ([2, 5, 8, 12, 13].includes(num)) return { label: t('spaciousAisleSeat'), desc: t('spaciousAisleSeatDesc') };
    return { label: t('standardCabinSeat'), desc: t('standardCabinSeatDesc') };
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
    
    let className = "bus-seat min-w-[48px] min-h-[48px]";
    if (isOccupied) className += " occupied";
    if (isSelected) className += " selected";
    if (isLocked) className += " locked-luggage";

    return (
      <div 
        key={num}
        className="p-1 touch-manipulation flex items-center justify-center"
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
            transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            minWidth: '48px',
            minHeight: '48px'
          }}
          title={isLocked ? t('luggageHoldAreaLocked') : isOccupied ? t('seatOccupiedTitle', { num }) : t('seatTitle', { num })}
        >
          <div className="bus-seat-inner" style={{ minWidth: '40px', minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isLocked ? (
              <span style={{ display: 'flex', alignItems: 'center' }} title={t('luggageLegend')}><Briefcase size={16} /></span>
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

  if (!tripId) return <div className="auth-page"><SEO title={seoTitle} description={seoDescription} /><div className="premium-card">{t('noTripSelected')}</div></div>;

  return (
    <div className="checkout-page-container">
      <SEO title={seoTitle} description={seoDescription} />
      <div style={{ maxWidth: '1200px', width: '100%', padding: '0 1.5rem', margin: '0 auto', boxSizing: 'border-box' }}>
        
        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 style={{ color: 'var(--text-primary)', marginTop: '1.25rem', fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
            {t('seatSelectionTitle')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            {t('fleetDesc')}
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
            <span className="stepper-label" style={{ color: 'var(--text-primary)' }}>{t('configureCommuteStepper')}</span>
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
            <span className="stepper-label" style={{ color: selectedSeats.length > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{t('selectPaymentStepper')}</span>
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
            <span className="stepper-label" style={{ color: processing ? 'var(--text-primary)' : 'var(--text-muted)' }}>{t('confirmSeatStepper')}</span>
          </div>
        </div>

        {loading ? (
          <div className="premium-card" style={{ textAlign: 'center', padding: '4rem' }}>
            <div style={{ animation: 'pulse 1.5s infinite', display: 'flex', justifyContent: 'center' }}>
              <Bus size={48} color="var(--text-secondary)" />
            </div>
            <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('loadingTripConfig')}</p>
          </div>
        ) : trip ? (
          <div className="split-layout-container">
            
            {/* Left Main Panel: Checkpoints and Seats */}
            <div className="main-panel">
              
              {/* Checkpoint Selection Map */}
              {trip.routeId?.checkpoints && trip.routeId.checkpoints.length > 0 && (
                <div className="premium-card">
                  <div className="premium-card-title">
                    <span>📍</span> {t('boardingAndDropoffTitle')}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
                      {t('verifyStopsHelper')}
                    </p>
                  </div>

                  <div style={{ height: '260px', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border)', zIndex: 1, marginBottom: '1.5rem' }}>
                    <MapContainer center={polylinePath[0] || [30.0444, 31.2357]} zoom={11} style={{ height: '100%', width: '100%' }}>
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url={theme === 'dark'
                          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                          : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'}
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
                              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexDirection: 'column' }}>
                                {cp.purpose === 'REST' && (
                                  <div style={{ fontSize: '11px', color: '#EF4444', fontWeight: 'bold', marginBottom: '4px' }}>
                                    {isRtl ? 'استراحة فقط - لا يمكن الحجز من/إلى هذا الموقف' : 'Rest Stop Only - Cannot book to/from here'}
                                  </div>
                                )}
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  {cp.purpose !== 'REST' && cp.purpose !== 'DROP_OFF' && (
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
                                  )}
                                  {cp.purpose !== 'REST' && cp.purpose !== 'PICKUP' && (
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
                                  )}
                                </div>
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
                    paddingBottom: '1rem',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    zIndex: 2,
                    background: 'rgba(255, 255, 255, 0.01)',
                    padding: '1.25rem 0.5rem 1rem 0.5rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.03)',
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box'
                  }} className="checkpoint-scrollbar">
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
                      top: '26px', 
                      left: `${100 / (trip.routeId.checkpoints.length * 2)}%`, 
                      right: `${100 / (trip.routeId.checkpoints.length * 2)}%`, 
                      height: '5px', 
                      background: 'rgba(255,255,255,0.08)', 
                      borderRadius: '4px',
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
                            top: '26px', 
                            left: `calc(${startPercent}% + ${100 / (checkpoints.length * 2)}% - ${startPercent / 100 * (100 / checkpoints.length)}%)`, 
                            width: `calc(${widthPercent}% - ${(widthPercent) / 100 * (100 / checkpoints.length)}%)`,
                            height: '5px', 
                            background: 'linear-gradient(90deg, var(--primary) 0%, #EF4444 100%)', 
                            borderRadius: '4px',
                            boxShadow: '0 0 10px rgba(245, 183, 49, 0.25)',
                            zIndex: 0,
                            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
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
                      
                      return (
                        <div 
                          key={cpIdx} 
                          onClick={() => {
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

                            let updated = false;
                            if (targetType === 'pickup') {
                              if (cp.purpose !== 'DROP_OFF') {
                                setSelectedPickupCheckpoint(cp);
                                updated = true;
                              }
                            } else {
                              if (cp.purpose !== 'PICKUP') {
                                setSelectedDropoffCheckpoint(cp);
                                updated = true;
                              }
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
                            minWidth: '110px',
                            zIndex: 1, 
                            position: 'relative', 
                            cursor: cp.purpose === 'REST' ? 'not-allowed' : 'pointer',
                            opacity: cp.purpose === 'REST' ? 0.4 : 1,
                          }}
                          className="p-3 touch-manipulation min-w-[48px] min-h-[48px] checkpoint-item"
                        >
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
                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
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
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Interactive Minibus Grid */}
              <div className="premium-card">
                <div className="premium-card-title">
                  <span>💺</span> {t('cabinLayoutTitle')}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {t('cabinLayoutDesc')}
                  </p>
                  <span style={{ fontSize: '11px', background: 'var(--surface-hover)', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {t('hiaceModelLabel')}
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
                  <span>{t('requestedSeatsLabel')}:</span>
                  <span>{t('requestedSeatsCountLabel', { count: selectedSeats.length, required: requiredSeatsCount })}</span>
                </div>

                <div className="bus-cabin">
                  {/* Windshield */}
                  <div className="bus-windshield windshield-opaque" style={{ marginBottom: '1rem' }} />
                  
                  {/* HiAce Dashboard */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                    <span title="Steering Wheel" style={{ opacity: 0.6 }}><Settings size={18} /></span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700 }}>{t('dashboardLabel')}</span>
                    <span title={t('dashboardLabel')} style={{ opacity: 0.5 }}><LayoutGrid size={16} /></span>
                  </div>

                  {/* Driver & VIP Row */}
                  <div className="cabin-row" style={{ marginBottom: '1rem' }}>
                    <div className="bus-seat driver" style={{ border: '2px dashed var(--border)', color: 'var(--text-muted)', cursor: 'not-allowed', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <User size={16} />
                    </div>
                    <div className="cabin-aisle" />
                    {renderSeat(1)}
                  </div>

                  {/* Sliding Entry Door */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '2px 0 10px 0' }}>
                    <div className="door-entry-opaque" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: 'var(--primary)', padding: '3px 8px', borderRadius: '4px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <ArrowRightToLine size={10} /> {t('slidingDoorEntryLabel')}
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="cabin-row">
                    {renderSeat(2)}
                    {renderSeat(3)}
                    <div className="cabin-aisle" />
                    {renderSeat(4)}
                  </div>

                  {/* Row 3 */}
                  <div className="cabin-row">
                    {renderSeat(5)}
                    {renderSeat(6)}
                    <div className="cabin-aisle" />
                    {renderSeat(7)}
                  </div>

                  {/* Row 4 */}
                  <div className="cabin-row">
                    {renderSeat(8)}
                    {renderSeat(9)}
                    <div className="cabin-aisle" />
                    {renderSeat(10)}
                  </div>

                  {/* Row 5 - Rear */}
                  <div className="cabin-row" style={{ marginBottom: '0.5rem' }}>
                    {renderSeat(11)}
                    {renderSeat(12)}
                    {renderSeat(13)}
                    {renderSeat(14)}
                  </div>

                  {/* Rear bumper */}
                  <div style={{ 
                    width: '60%', 
                    height: '6px', 
                    margin: '0.5rem auto 0', 
                    background: 'var(--border)', 
                    borderRadius: '0 0 4px 4px',
                    opacity: 0.6
                  }} />

                  {/* Legends */}
                  <div className="seat-legend" style={{ display: 'flex', justifyContent: 'space-around', marginTop: '2.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      <div className="legend-dot" style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--border)' }}></div>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{t('availableLegend')}</span>
                    </div>
                    <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      <div className="legend-dot" style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--primary)' }}></div>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{t('selectedLegend')}</span>
                    </div>
                    <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      <div className="legend-dot" style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--surface-hover)', border: '1px solid var(--border)' }}></div>
                      <span style={{ color: 'var(--text-secondary)', opacity: 0.5, fontWeight: 500 }}>{t('occupiedLegend')}</span>
                    </div>
                    <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      <span style={{ display: 'flex', alignItems: 'center' }}><Briefcase size={14} /></span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{t('luggageLegend')}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Sticky Sidebar Panel: Summary and Reservation Actions */}
            <div className="sidebar-panel">
              
              {/* Booking Summary Card */}
              <div className="premium-card">
                <div className="premium-card-title">
                  <span>📋</span> {t('commuteDetailsLabel')}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>{t('lineRouteLabel')}</div>
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.1rem', marginTop: '2px' }}>
                      {trip.routeId?.name || t('standardRoute')}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                      {selectedPickupCheckpoint?.localizedDepartureTime ? t('localizedBoardingTimeLabel') : t('departureTime')}
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem', marginTop: '2px' }}>
                      {(() => {
                        const baseTime = new Date(trip.departureTime).getTime();
                        const timeToUse = selectedPickupCheckpoint?.localizedDepartureTime 
                          ? new Date(selectedPickupCheckpoint.localizedDepartureTime)
                          : (selectedPickupCheckpoint?.estimatedDepartureTime 
                              ? new Date(selectedPickupCheckpoint.estimatedDepartureTime)
                              : (selectedPickupCheckpoint?.minutesFromStart !== undefined
                                  ? new Date(baseTime + selectedPickupCheckpoint.minutesFromStart * 60000)
                                  : new Date(trip.departureTime)));
                        
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
                      <span className="checkpoint-timeline-label">{t('selectedPickup')}</span>
                      <span className="checkpoint-timeline-value">
                        {isRtl ? (selectedPickupCheckpoint?.nameAr || selectedPickupCheckpoint?.name || t('notSelectedLabel')) : (selectedPickupCheckpoint?.name || t('notSelectedLabel'))}
                        {selectedPickupCheckpoint?.localizedDepartureTime && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--primary)', marginLeft: '8px' }}>
                            ({new Date(selectedPickupCheckpoint.localizedDepartureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                          </span>
                        )}
                      </span>
                    </div>
                    
                    <div className="checkpoint-timeline-item dropoff">
                      <div className="checkpoint-timeline-dot" />
                      <span className="checkpoint-timeline-label">{t('selectedDropoff')}</span>
                      <span className="checkpoint-timeline-value">
                        {isRtl ? (selectedDropoffCheckpoint?.nameAr || selectedDropoffCheckpoint?.name || t('notSelectedLabel')) : (selectedDropoffCheckpoint?.name || t('notSelectedLabel'))}
                        {selectedDropoffCheckpoint?.localizedArrivalTime && (
                          <span style={{ fontSize: '0.8rem', color: '#EF4444', marginLeft: '8px' }}>
                            ({new Date(selectedDropoffCheckpoint.localizedArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reactive Seat details card */}
              {selectedSeats.length > 0 && (
                <div className="premium-card premium-card-solid-amber">
                  <div className="premium-card-title" style={{ borderBottomColor: '#f5b731', color: 'var(--primary)' }}>
                    <span>🎫</span> {t('selectedSlots')}
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
                        {t('seatTitle', { num })}
                      </span>
                    ))}
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                    {selectedSeats.length === 1 
                      ? getSeatLabel(selectedSeats[0]).desc
                      : t('bookingMultipleSeatsDesc')
                    }
                  </p>
                </div>
              )}

              {/* Invoice breakdown card */}
              <div className="premium-card">
                <div className="premium-card-title">
                  <span>🧾</span> {t('invoiceBreakdownLabel')}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '8px', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{t('legSegmentLabel')}</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--primary)', textAlign: 'right', wordBreak: 'break-word', minWidth: 0 }}>
                      {isRtl ? (selectedPickupCheckpoint?.nameAr || selectedPickupCheckpoint?.name || t('startLabel')) : (selectedPickupCheckpoint?.name || t('startLabel'))} ➔ {isRtl ? (selectedDropoffCheckpoint?.nameAr || selectedDropoffCheckpoint?.name || t('endLabel')) : (selectedDropoffCheckpoint?.name || t('endLabel'))}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{t('selectedSlots')} ({selectedSeats.length})</span>
                    <span style={{ fontWeight: 'bold', color: selectedSeats.length > 0 ? 'var(--primary)' : 'var(--text-primary)' }}>
                      {selectedSeats.length > 0 ? selectedSeats.map(s => `#${s}`).join(', ') : t('notSelectedLabel')}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{t('baseFareLabel')}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {Math.round(legSubTotalFare * 0.86)} EGP
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{t('vatIncluded')}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {legSubTotalFare - Math.round(legSubTotalFare * 0.86)} EGP
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{t('bookingFeeLabel')}</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>
                      0.00 EGP (FREE)
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{t('totalFare')}</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                      {legSubTotalFare} EGP
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
                    ? t('reservingSeatsLoading')
                    : selectedSeats.length !== requiredSeatsCount
                      ? t('selectRequiredSeatsButton', { count: requiredSeatsCount })
                      : t('confirmAndProceedBtn')
                  }
                </button>
                
                <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', textAlign: 'center', margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <Lock size={12} /> {t('seatsTemporaryHoldInfo')}
                </p>
              </div>

            </div>

          </div>
        ) : (
          <div className="premium-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>{t('tripConfigNotFound')}</p>
            <button onClick={() => navigate('/')} className="btn-primary" style={{ marginTop: '1.5rem' }}>{t('returnToHome')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
