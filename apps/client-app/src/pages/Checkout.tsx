import { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api, { bookingsAPI, routesAPI } from '../services/api';
import { Briefcase, Settings, LayoutGrid, User, ArrowRightToLine, Lock, Bus, Phone, RefreshCw } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import SEO from '../components/SEO';
import { useAuth } from '../context/AuthContext';
import { Steps } from '../components/ui/steps';

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from '../context/ThemeContext';
import { calculateLegPrice, calculatePremiumSurcharge, calculateSubTotalFare } from '../utils/pricing';

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get('tripId');
  const passengersParam = searchParams.get('passengers');
  const requiredSeatsCount = passengersParam ? Math.max(1, parseInt(passengersParam, 10)) : 1;
  const roundTripParam = searchParams.get('roundTrip') === 'true';
  const returnDateParam = searchParams.get('returnDate');
  const returnPickupLat = searchParams.get('returnPickupLat');
  const returnPickupLng = searchParams.get('returnPickupLng');
  const returnDropoffLat = searchParams.get('returnDropoffLat');
  const returnDropoffLng = searchParams.get('returnDropoffLng');
  const returnPickupCity = searchParams.get('returnPickupCity');
  const returnDropoffCity = searchParams.get('returnDropoffCity');
  const forwardBookingIdParam = searchParams.get('forwardBookingId');
  const navigate = useNavigate();
  const { t, isRtl, language } = useTranslation();
  const { user, updateProfile } = useAuth();
  const { theme } = useTheme();

  const isAr = language === 'ar';
  const seoTitle = isAr ? 'اختيار المقاعد والدفع | دي-رايد' : 'Select Seats & Checkout | D-Ride';
  const seoDescription = isAr
    ? 'اختر محطات الركوب والنزول وحدد مقاعدك المفضلة على مخطط كابينة حافلة تويوتا هايس التابعة لدي-رايد.'
    : 'Configure your checkpoints and select your seats in the Toyota HiAce cabin for your D-Ride commute.';

  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const isSubmitting = useRef(false);
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [myPendingSeats, setMyPendingSeats] = useState<number[]>([]);
  const [occupiedSeatsRaw, setOccupiedSeatsRaw] = useState<number[]>([]);
  const occupiedSeats = useMemo(() => {
    return occupiedSeatsRaw.filter(s => !myPendingSeats.includes(s));
  }, [occupiedSeatsRaw, myPendingSeats]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  const [selectedPickupCheckpoint, setSelectedPickupCheckpoint] = useState<any>(null);
  const [selectedDropoffCheckpoint, setSelectedDropoffCheckpoint] = useState<any>(null);
  const [mapFocusCoords, setMapFocusCoords] = useState<[number, number] | null>(null);

  // Track which checkpoint names are pickup/dropoff to avoid reading popup HTML
  const pickupCheckpointNameRef = useRef<string | null>(null);
  const dropoffCheckpointNameRef = useRef<string | null>(null);

  // Phone Prompt States
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [promptPhone, setPromptPhone] = useState('');
  const [promptError, setPromptError] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);

  const getLegPrice = () => calculateLegPrice(trip, selectedPickupCheckpoint, selectedDropoffCheckpoint);

  const legPrice = getLegPrice();
  
  const getLegPremiumSurcharge = () => calculatePremiumSurcharge(trip, selectedPickupCheckpoint, selectedDropoffCheckpoint);

  const getLegSubTotalFare = () => calculateSubTotalFare({
    legPrice,
    selectedSeats,
    premiumSurcharge: getLegPremiumSurcharge(),
  });
  
  const legSubTotalFare = getLegSubTotalFare();



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
    if (!tripId || !user) return;

    bookingsAPI.getMyBookings()
      .then(bookings => {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const pending = bookings.find((b: any) => {
          const bTripId = b.tripId?._id || b.tripId?.id || b.tripId;
          const isThisTrip = bTripId === tripId;
          const isPending = b.status === 'PENDING_PAYMENT' || b.status === 'PENDING';
          const bCreatedAt = b.createdAt ? new Date(b.createdAt) : new Date();
          const isRecent = bCreatedAt.getTime() >= tenMinutesAgo.getTime();
          return isThisTrip && isPending && isRecent;
        });

        if (pending && pending.seatNumbers) {
          const seats = pending.seatNumbers.map(Number);
          setMyPendingSeats(seats);
          setSelectedSeats(seats);
        }
      })
      .catch(console.error);
  }, [tripId, user]);

  useEffect(() => {
    if (!tripId) return;

    const pickupName = selectedPickupCheckpoint?.name;
    const dropoffName = selectedDropoffCheckpoint?.name;

    bookingsAPI.getOccupiedSeats(tripId, pickupName, dropoffName)
      .then(seats => {
        setOccupiedSeatsRaw(seats);
      })
      .catch(console.error);
  }, [tripId, selectedPickupCheckpoint, selectedDropoffCheckpoint]);

  // Keep selectedSeats filtered: if any seat in selectedSeats becomes occupied (by someone else), remove it.
  useEffect(() => {
    if (occupiedSeats.length > 0) {
      setSelectedSeats(prev => {
        const next = prev.filter(s => !occupiedSeats.includes(s));
        if (next.length !== prev.length) return next;
        return prev;
      });
    }
  }, [occupiedSeats]);

  useEffect(() => {
    if (!mapContainerRef.current || !trip?.routeId) return;

    // Center coordinates - MapLibre uses [lng, lat]
    const routeCoords: [number, number][] = trip.routeId.path?.coordinates || [];
    const centerCoords: [number, number] = routeCoords[0] || [31.2357, 30.0444];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: theme === 'dark' ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/positron',
      center: centerCoords,
      zoom: 11,
      attributionControl: false,
      scrollZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      dragPan: false,
      dragRotate: false,
      touchZoomRotate: false,
      pitchWithRotate: false,
      keyboard: false
    });

    // Suppress missing sprite image warnings by providing dummy transparent images
    map.on('styleimagemissing', (e) => {
      const width = 16;
      const height = 16;
      const data = new Uint8Array(width * height * 4); // transparent pixels
      if (!map.hasImage(e.id)) {
        map.addImage(e.id, { width, height, data });
      }
    });

    mapRef.current = map;
    setMapLoaded(false);

    map.on('load', () => {
      setMapLoaded(true);

      // Add polyline path
      if (routeCoords.length > 0) {
        map.addSource('route-path', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: routeCoords
            }
          }
        });

        map.addLayer({
          id: 'route-line-casing',
          type: 'line',
          source: 'route-path',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': theme === 'dark' ? '#174ea6' : '#ffffff',
            'line-width': 8,
            'line-opacity': 0.9
          }
        });

        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route-path',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': theme === 'dark' ? '#8ab4f8' : '#1a73e8',
            'line-width': 5,
            'line-opacity': 0.95
          }
        });

        // Fit bounds
        const bounds = routeCoords.reduce(
          (acc, coord) => {
            return [
              [Math.min(acc[0][0], coord[0]), Math.min(acc[0][1], coord[1])],
              [Math.max(acc[1][0], coord[0]), Math.max(acc[1][1], coord[1])]
            ];
          },
          [[routeCoords[0][0], routeCoords[0][1]], [routeCoords[0][0], routeCoords[0][1]]]
        ) as [[number, number], [number, number]];

        map.fitBounds(bounds, { padding: 40, duration: 1200 });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, [trip, theme]);

  // Separate effect for checkpoint markers - only depends on trip and mapLoaded
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !trip?.routeId) return;

    // Remove existing checkpoint markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Add Checkpoint Markers
    trip.routeId.checkpoints.forEach((cp: any, idx: number) => {
      const cpCoords: [number, number] = [cp.location.coordinates[0], cp.location.coordinates[1]];
      const isPickup = selectedPickupCheckpoint && selectedPickupCheckpoint.name === cp.name;
      const isDropoff = selectedDropoffCheckpoint && selectedDropoffCheckpoint.name === cp.name;

      const el = document.createElement('div');
      const pinSize = isPickup || isDropoff ? '32px' : '22px';
      el.style.width = pinSize;
      el.style.height = pinSize;

      const pinEl = document.createElement('div');
      if (isPickup) {
        pinEl.className = 'google-maps-start-pin';
      } else if (isDropoff) {
        pinEl.className = 'google-maps-dest-pin';
      } else {
        pinEl.className = 'google-maps-stop-pin';
        pinEl.innerText = String(idx);
      }
      el.appendChild(pinEl);

      // Popup HTML
      let popupHtml = `<div style="color: var(--text-primary); font-family: 'Roboto', 'Inter', sans-serif; font-size: 12px; line-height: 1.4; padding: 4px;">`;
      popupHtml += `<strong>${isRtl ? (cp.nameAr || cp.name) : cp.name}</strong>`;
      if (isPickup) {
        popupHtml += `<div style="font-size: 11px; color: #0f9d58; font-weight: bold; margin-top: 4px;">🚶 ${isRtl ? 'نقطة الركوب المحددة' : 'Selected Pickup'}</div>`;
      }
      if (isDropoff) {
        popupHtml += `<div style="font-size: 11px; color: #ea4335; font-weight: bold; margin-top: 4px;">🏁 ${isRtl ? 'نقطة النزول المحددة' : 'Selected Dropoff'}</div>`;
      }
      if (cp.purpose === 'REST') {
        popupHtml += `<div style="font-size: 11px; color: #ea4335; font-weight: bold; margin-top: 4px;">🛑 ${isRtl ? 'استراحة فقط - لا يمكن الحجز من/إلى هذا الموقف' : 'Rest Stop Only - Cannot book to/from here'}</div>`;
      }
      popupHtml += `</div>`;

      const popup = new maplibregl.Popup({ offset: isPickup || isDropoff ? 15 : 10 }).setHTML(popupHtml);

      const marker = new maplibregl.Marker({ element: el, anchor: isPickup || isDropoff ? 'bottom' : 'center' })
        .setLngLat(cpCoords)
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [mapLoaded, trip]); // Only re-run when map loads or trip changes

  // Separate effect for user location marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !userLocation) return;

    // Remove only user location marker (last one if it's a user marker)
    const userMarkers = markersRef.current.filter(m => 
      m.getElement().style.width === '16px'
    );
    userMarkers.forEach(m => {
      m.remove();
      markersRef.current = markersRef.current.filter(marker => marker !== m);
    });

    const uEl = document.createElement('div');
    uEl.style.width = '16px';
    uEl.style.height = '16px';
    uEl.style.borderRadius = '50%';
    uEl.style.backgroundColor = '#4285F4';
    uEl.style.border = '2px solid white';
    uEl.style.boxShadow = '0 0 8px #4285F4';

    const uPopup = new maplibregl.Popup({ offset: 10 }).setHTML(`<div style="color:#000; font-family: 'Roboto', 'Inter', sans-serif; font-size:11px; font-weight:bold; padding:2px;">You are here</div>`);

    const uMarker = new maplibregl.Marker({ element: uEl })
      .setLngLat([userLocation[1], userLocation[0]])
      .setPopup(uPopup)
      .addTo(map);

    markersRef.current.push(uMarker);
  }, [mapLoaded, userLocation]); // Only re-run when user location changes

  // Update refs when selected checkpoints change
  useEffect(() => {
    pickupCheckpointNameRef.current = selectedPickupCheckpoint?.name || null;
    dropoffCheckpointNameRef.current = selectedDropoffCheckpoint?.name || null;
  }, [selectedPickupCheckpoint, selectedDropoffCheckpoint]);

  // Separate effect for selected checkpoint highlighting - uses refs instead of popup HTML
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    
    const pickupName = pickupCheckpointNameRef.current;
    const dropoffName = dropoffCheckpointNameRef.current;
    
    // Update marker colors for pickup/dropoff selection
    markersRef.current.forEach((marker) => {
      const el = marker.getElement();
      if (!el) return;
      
      const popup = marker.getPopup();
      if (!popup) return;
      
      const popupHtml = (popup._content as HTMLElement)?.innerHTML || '';
      const isPickup = pickupName && popupHtml?.includes(pickupName) && popupHtml?.includes('Selected Pickup');
      const isDropoff = dropoffName && popupHtml?.includes(dropoffName) && popupHtml?.includes('Selected Dropoff');
      
      if (isPickup || isDropoff) {
        el.style.width = '32px';
        el.style.height = '32px';
      } else {
        el.style.width = '22px';
        el.style.height = '22px';
      }
    });
  }, [mapLoaded, selectedPickupCheckpoint, selectedDropoffCheckpoint]);


  useEffect(() => {
    if (mapRef.current && mapFocusCoords) {
      mapRef.current.flyTo({
        center: [mapFocusCoords[1], mapFocusCoords[0]], // convert [lat, lng] to [lng, lat]
        zoom: 14,
        speed: 1.2
      });
    }
  }, [mapFocusCoords]);


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

  const performReservation = async () => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setProcessing(true);
    try {
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

      const bookingId = booking._id || booking.id;

      if (roundTripParam && returnDateParam) {
        // Forward leg of round trip — redirect to return trip search
        const returnSearch = `/search?pickupLat=${returnPickupLat}&pickupLng=${returnPickupLng}&dropoffLat=${returnDropoffLat}&dropoffLng=${returnDropoffLng}&date=${returnDateParam}&passengers=${requiredSeatsCount}&pickupCity=${encodeURIComponent(returnPickupCity || '')}&dropoffCity=${encodeURIComponent(returnDropoffCity || '')}&roundTrip=true&forwardBookingId=${bookingId}`;
        navigate(returnSearch);
      } else if (forwardBookingIdParam) {
        // Return leg of round trip — redirect to payment with both
        navigate(`/payment?bookingIds=${forwardBookingIdParam},${bookingId}`);
      } else {
        // Single trip
        navigate(`/payment?bookingId=${bookingId}`);
      }
    } catch (error) {
      const errData = error as any;
      if (errData?.existingBookingId) {
        navigate(`/payment?bookingId=${errData.existingBookingId}`);
        return;
      }
      alert(t('reservationFailed') + (errData?.message || 'Unknown error'));
    } finally {
      setProcessing(false);
      isSubmitting.current = false;
    }
  };

  const handleReserve = async () => {
    if (processing || isSubmitting.current) return;

    if (selectedSeats.length !== requiredSeatsCount) {
      alert(t('pleaseSelectSeatsToMatch', { count: requiredSeatsCount }));
      return;
    }

    if (!user?.phone) {
      setPromptPhone('');
      setPromptError('');
      setShowPhonePrompt(true);
      return;
    }

    await performReservation();
  };

  const handlePromptPhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting.current) return;
    setPromptError('');
    
    const cleanPhone = promptPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 11) {
      setPromptError(isAr ? 'يجب أن يكون رقم الهاتف مكوناً من 11 رقماً' : 'Phone number must be exactly 11 digits');
      return;
    }
    const normalizedPhone = '+20' + cleanPhone.substring(1);
    
    setPromptLoading(true);
    isSubmitting.current = true;
    try {
      await updateProfile({ phone: normalizedPhone });
      setShowPhonePrompt(false);
      
      // Perform reservation with normalized phone now in user record
      setProcessing(true);
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

      navigate(`/payment?bookingId=${booking._id || booking.id}`);
    } catch (err: any) {
      if (err?.existingBookingId) {
        navigate(`/payment?bookingId=${err.existingBookingId}`);
        return;
      }
      setPromptError(err?.message || 'Failed to update phone number. Please try again.');
    } finally {
      setPromptLoading(false);
      setProcessing(false);
      isSubmitting.current = false;
    }
  };

  const getSeatLabel = (num: number) => {
    if (num === 1) {
      const surcharge = getLegPremiumSurcharge();
      return { 
        label: t('vipCockpitSeat'), 
        desc: surcharge > 0 
          ? `${t('vipCockpitSeatDesc')} (VIP Surcharge: +${surcharge} EGP)` 
          : t('vipCockpitSeatDesc') 
      };
    }
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

    const currentSurcharge = getLegPremiumSurcharge();
    const isPremiumSeat1 = num === 1 && currentSurcharge > 0;

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
            minHeight: '48px',
            border: isPremiumSeat1 && !isSelected && !isOccupied ? '2px solid var(--primary-interactive)' : undefined,
            boxShadow: isPremiumSeat1 && !isSelected && !isOccupied ? 'var(--shadow-glow)' : undefined,
            borderRadius: isPremiumSeat1 ? '10px' : undefined
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
                  {num}{isPremiumSeat1 && !isSelected && '👑'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };



  if (!tripId) return <div className="auth-page"><SEO title={seoTitle} description={seoDescription} /><div className="premium-card">{t('noTripSelected')}</div></div>;

  return (
    <div className="checkout-page-container">
      <SEO title={seoTitle} description={seoDescription} />
      <div style={{ maxWidth: '1200px', width: '100%', padding: '0 1.5rem', margin: '0 auto', boxSizing: 'border-box' }}>
        
        {/* Header Section */}
        <div className="checkout-header-section" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 style={{ color: 'var(--text-primary)', marginTop: '1.25rem', fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
            {t('seatSelectionTitle')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            {t('fleetDesc')}
          </p>
        </div>

        {/* Visual Stepper */}
        <div className="checkout-stepper-section" style={{
          maxWidth: '600px',
          margin: '0 auto 3.5rem auto',
          padding: '0 1.5rem'
        }}>
          <Steps
            current={processing ? 2 : (selectedSeats.length > 0 ? 1 : 0)}
            isRtl={isRtl}
            items={[
              { title: <span className="stepper-label">{t('configureCommuteStepper')}</span> },
              { title: <span className="stepper-label">{t('selectPaymentStepper')}</span> },
              { title: <span className="stepper-label">{t('confirmSeatStepper')}</span> }
            ]}
          />
        </div>

        {loading ? (
          <div className="premium-card" style={{ textAlign: 'center', padding: '4rem' }}>
            <div style={{ animation: 'pulse 1.5s infinite', display: 'flex', justifyContent: 'center' }}>
              <Bus size={48} color="var(--text-secondary)" />
            </div>
            <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('loadingTripConfig')}</p>
          </div>
        ) : trip ? (
          <div className="checkout-cards-wrapper" style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Interactive Minibus Grid Card */}
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
                className={`checkout-selection-box ${selectedSeats.length === requiredSeatsCount ? 'success-box-opaque' : 'warning-box-opaque'}`}
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
                <span>
                  {selectedSeats.length > 0 && <span style={{ color: 'var(--primary-interactive)', marginInlineEnd: '6px', fontWeight: 'bold' }}>({selectedSeats.map(s => `#${s}`).join(', ')})</span>}
                  {t('requestedSeatsCountLabel', { count: selectedSeats.length, required: requiredSeatsCount })}
                </span>
              </div>

              {selectedSeats.length > 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', marginTop: '-1.25rem', padding: '0 4px', lineHeight: 1.4 }}>
                  💡 {selectedSeats.length === 1 
                    ? `${getSeatLabel(selectedSeats[0]).label}: ${getSeatLabel(selectedSeats[0]).desc}`
                    : t('bookingMultipleSeatsDesc')
                  }
                </div>
              )}

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

            {/* Checkpoint Selection Map Card */}
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
                  <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
                </div>

                {/* Checkpoint Stepper Progress bar */}
                {/* Ant Design Timeline */}
                {(() => {
                  const checkpoints = trip.routeId.checkpoints || [];
                  const pickupIdx = selectedPickupCheckpoint
                    ? checkpoints.findIndex((cp: any) => cp.name === selectedPickupCheckpoint.name)
                    : 0;
                  const dropoffIdx = selectedDropoffCheckpoint
                    ? checkpoints.findIndex((cp: any) => cp.name === selectedDropoffCheckpoint.name)
                    : checkpoints.length - 1;
                  const startIdx = pickupIdx >= 0 ? pickupIdx : 0;
                  const endIdx = dropoffIdx >= 0 ? dropoffIdx : checkpoints.length - 1;
                  const journeyCps = checkpoints.slice(startIdx, endIdx + 1);

                  const baseTripDepTime = new Date(trip.departureTime).getTime();

                  return journeyCps.length > 0 ? (
                    <div style={{ marginTop: '1.5rem', width: '100%' }}>
                      <style>{`
                        /* Ant Design Timeline Mock Style (Normal Timeline) */
                        .ant-timeline {
                          display: flex;
                          width: 100%;
                          position: relative;
                          margin: 0;
                          padding: 0;
                          list-style: none;
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
                          background: var(--border);
                          z-index: 0;
                        }
                        .ant-timeline-item:last-child .ant-timeline-item-tail {
                          display: none;
                        }
                        .ant-timeline-item-head {
                          width: 10px;
                          height: 10px;
                          border-radius: 50%;
                          background: var(--surface);
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

                      <ul className="ant-timeline ant-timeline-horizontal">
                        {journeyCps.map((cp: any, idx: number) => {
                          const cpEstimatedTime = cp.minutesFromStart !== undefined
                            ? new Date(baseTripDepTime + cp.minutesFromStart * 60 * 1000)
                            : null;
                          const cpTimeStr = cpEstimatedTime
                            ? cpEstimatedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '';
                          const cpDateStr = cpEstimatedTime
                            ? cpEstimatedTime.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '';

                          // Highlight pickup (first) and dropoff (last) checkpoints
                          const isFirst = idx === 0;
                          const isLast = idx === journeyCps.length - 1;

                          return (
                            <li key={cp.name} className="ant-timeline-item">
                              <div className="ant-timeline-item-tail"></div>
                              <div 
                                className="ant-timeline-item-head"
                                style={{
                                  borderColor: isFirst ? 'var(--primary)' : (isLast ? 'var(--danger)' : 'var(--border)'),
                                  boxShadow: isFirst ? '0 0 6px var(--primary)' : (isLast ? '0 0 6px var(--danger)' : 'none'),
                                }}
                              ></div>
                              <div className="ant-timeline-item-content">
                                <div className="ant-timeline-item-title" style={{ color: isFirst ? 'var(--primary)' : (isLast ? 'var(--danger)' : 'var(--text-primary)') }}>
                                  {isRtl ? (cp.nameAr || cp.name) : cp.name}
                                </div>
                                {(isFirst || isLast) && cpDateStr && (
                                  <div className="ant-timeline-item-time" style={{ fontWeight: 650, color: 'var(--text-muted)', marginBottom: '1px' }}>
                                    {cpDateStr}
                                  </div>
                                )}
                                <div className="ant-timeline-item-time">
                                  {cpTimeStr}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null;
                })()}

                {/* Commute Route & Cost Info Block */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  gap: '1rem', 
                  borderTop: '1px solid var(--border)', 
                  paddingTop: '1.25rem', 
                  marginTop: '1.5rem', 
                  flexWrap: 'wrap' 
                }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>{t('lineRouteLabel')}</div>
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.05rem', marginTop: '2px' }}>
                      {trip.routeId?.name || t('standardRoute')}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>{t('departureTime')}</div>
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
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                      {isRtl ? 'التكلفة الإجمالية' : 'Total Cost'}
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--primary-interactive)', fontSize: '1.15rem', marginTop: '2px' }}>
                      {legSubTotalFare} EGP
                    </div>
                  </div>
                </div>

                {/* Action Trigger Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '2.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
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
            )}

          </div>
        ) : (
          <div className="premium-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>{t('tripConfigNotFound')}</p>
            <button onClick={() => navigate('/')} className="btn-primary" style={{ marginTop: '1.5rem' }}>{t('returnToHome')}</button>
          </div>
        )}
      </div>

      {/* Phone Number Prompt Modal */}
      {showPhonePrompt && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(6, 6, 14, 0.85)',
            backdropFilter: 'blur(16px)',
            zIndex: 10007,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div 
            style={{
              background: 'var(--surface-elevated)',
              color: 'var(--text-primary)',
              borderRadius: '24px',
              padding: '2.5rem 2rem',
              maxWidth: '420px',
              width: '100%',
              border: '1px solid var(--border)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4)',
              position: 'relative'
            }}
          >
            <button 
              onClick={() => setShowPhonePrompt(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: isRtl ? 'auto' : '16px',
                left: isRtl ? '16px' : 'auto',
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                color: 'var(--text-muted)',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '14px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              ✕
            </button>

            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: 'var(--primary-interactive)' }}>
                <Phone size={40} />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--primary-interactive)' }}>
                {isAr ? 'أدخل رقم الهاتف' : 'Enter Phone Number'}
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                {isAr 
                  ? 'يرجى تقديم رقم هاتف مصري صالح لتلقي تأكيد الحجز وإشعارات الرحلة عبر الرسائل القصيرة والواتساب.'
                  : 'Please provide a valid Egyptian phone number to receive your booking confirmation and trip notifications via SMS & WhatsApp.'}
              </p>
            </div>

            {promptError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--danger)',
                padding: '10px 14px',
                borderRadius: '12px',
                fontSize: '0.85rem',
                marginBottom: '1.5rem',
                fontWeight: 500
              }}>
                {promptError}
              </div>
            )}

            <form onSubmit={handlePromptPhoneSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="prompt-phone-input" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {isAr ? 'رقم الهاتف (11 رقم)' : 'Phone Number (11 digits)'}
                </label>
                <input
                  id="prompt-phone-input"
                  type="tel"
                  value={promptPhone}
                  onChange={(e) => setPromptPhone(e.target.value)}
                  placeholder={isAr ? '01012345678' : '01012345678'}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    background: 'var(--surface-hover)',
                    color: 'var(--text-primary)',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowPhonePrompt(false)}
                  style={{
                    flex: 1,
                    background: 'var(--surface-hover)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                
                <button
                  type="submit"
                  disabled={promptLoading}
                  style={{
                    flex: 2,
                    background: 'var(--primary)',
                    color: 'var(--text-on-primary)',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    opacity: promptLoading ? 0.7 : 1
                  }}
                >
                  {promptLoading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      {isAr ? 'حفظ...' : 'Saving...'}
                    </>
                  ) : (
                    isAr ? 'حفظ ومتابعة الحجز' : 'Save & Continue'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
