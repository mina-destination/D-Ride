import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { routesAPI, partnersAPI } from '../services/api';
import logo from '../assets/d-ride-logo.jpeg';
import { Map, MapPin, Search, Ticket, Bus, CreditCard, Snowflake, Zap, Calendar, Users, ArrowUpDown, X, Globe } from 'lucide-react';

import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cleanGoogleDriveLink } from '../utils/google-drive';

// Fix default marker icon in Vite react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});


function MapClickHandler({ onClick }: { onClick: (latlng: any) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng);
    },
  });
  return null;
}

function RouteSearchForm() {
  const { isRtl } = useTranslation();
  const [routes, setRoutes] = useState<any[]>([]);
  const [fromStation, setFromStation] = useState<any>(null);
  const [toStation, setToStation] = useState<any>(null);
  const [travelDate, setTravelDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [passengers, setPassengers] = useState<number>(1);
  const navigate = useNavigate();

  // Swvl-style autocomplete states
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [fromFocused, setFromFocused] = useState(false);
  const [toFocused, setToFocused] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false);
  const [shakeFields, setShakeFields] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState<boolean>(false);
  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);

  // Map modal states
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [mapPickerCoords, setMapPickerCoords] = useState<[number, number] | null>(null);
  const [nearestStationFromMap, setNearestStationFromMap] = useState<any>(null);
  const [mapLoading, setMapLoading] = useState(false);

  const fetchNearestStationForCoords = async (coords: [number, number]) => {
    try {
      setMapLoading(true);
      const results = await routesAPI.getNearestStation(coords[0], coords[1], 1);
      if (results && results.length > 0) {
        setNearestStationFromMap(results[0]);
      } else {
        setNearestStationFromMap(null);
      }
    } catch (err) {
      console.error('Failed to get nearest station', err);
    } finally {
      setMapLoading(false);
    }
  };

  const handleOpenMapPicker = async () => {
    setIsMapModalOpen(true);
    let initialCoords: [number, number] = [30.0444, 31.2357];
    if (fromStation && fromStation.lat && fromStation.lng) {
      initialCoords = [fromStation.lat, fromStation.lng];
    }
    setMapPickerCoords(initialCoords);
    await fetchNearestStationForCoords(initialCoords);
  };

  const handleMapClick = async (latlng: any) => {
    const coords: [number, number] = [latlng.lat, latlng.lng];
    setMapPickerCoords(coords);
    await fetchNearestStationForCoords(coords);
  };

  const handleMarkerDragEnd = async (e: any) => {
    const marker = e.target;
    if (marker != null) {
      const latLng = marker.getLatLng();
      const coords: [number, number] = [latLng.lat, latLng.lng];
      setMapPickerCoords(coords);
      await fetchNearestStationForCoords(coords);
    }
  };

  const handleConfirmMapSelection = () => {
    if (nearestStationFromMap) {
      const cp = nearestStationFromMap.checkpoint;
      const route = nearestStationFromMap.route;
      const parts = route.name.split(/\s+to\s+/i);
      const fromC = parts.length >= 1 ? parts[0].trim() : '';
      const city = cp.city || fromC.charAt(0).toUpperCase() + fromC.slice(1);

      const station = {
        name: cp.name,
        nameAr: cp.nameAr,
        lat: cp.location.coordinates[1],
        lng: cp.location.coordinates[0],
        city: city,
        routeId: route._id || route.id,
        order: cp.order
      };

      setFromStation(station);
      setFromQuery(isRtl ? (station.nameAr || station.name) : station.name);
      setIsMapModalOpen(false);
    }
  };

  // Load all routes to extract cities and stations
  useEffect(() => {
    routesAPI.getAll().then((data) => setRoutes(data)).catch(console.error);
  }, []);

  // Parse all checkpoints for autocomplete index
  const allCheckpoints = useMemo(() => {
    const list: any[] = [];
    routes.forEach((route) => {
      const checkpoints = route.checkpoints || [];
      const parts = route.name.split(/\s+to\s+/i);
      const defaultFromCity = parts[0] ? parts[0].trim() : '';

      checkpoints.forEach((cp: any) => {
        const coords = cp.location?.coordinates;
        if (!coords) return;

        list.push({
          name: cp.name,
          nameAr: cp.nameAr || cp.name,
          lat: coords[1],
          lng: coords[0],
          city: cp.city || defaultFromCity.charAt(0).toUpperCase() + defaultFromCity.slice(1),
          routeId: route._id || route.id,
          order: cp.order || 0,
        });
      });
    });
    // Remove duplicate stops if they have same name and coordinates
    const seen = new Set<string>();
    return list.filter((item) => {
      const key = `${item.name}-${item.lat}-${item.lng}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [routes]);

  // Compute reachable stops once a boarding stop is chosen
  const reachableDropoffStations = useMemo(() => {
    if (!fromStation) return [];

    // Find all route checkpoints that match the selected fromStation's name
    const matches = allCheckpoints.filter(cp => cp.name === fromStation.name);

    // Get all checkpoints from the same routes that have an order > the matched pickup's order
    const list: any[] = [];
    matches.forEach(pickup => {
      routes.forEach(route => {
        const rId = route._id || route.id;
        if (rId === pickup.routeId) {
          const checkpoints = route.checkpoints || [];
          const parts = route.name.split(/\s+to\s+/i);
          const defaultFromCity = parts[0] ? parts[0].trim() : '';

          checkpoints.forEach((cp: any) => {
            if (cp.order > pickup.order) {
              const coords = cp.location?.coordinates;
              if (coords) {
                list.push({
                  name: cp.name,
                  nameAr: cp.nameAr || cp.name,
                  lat: coords[1],
                  lng: coords[0],
                  city: cp.city || defaultFromCity.charAt(0).toUpperCase() + defaultFromCity.slice(1),
                  routeId: rId,
                  order: cp.order,
                });
              }
            }
          });
        }
      });
    });

    // Deduplicate by name and coordinates
    const seen = new Set<string>();
    return list.filter((item) => {
      const key = `${item.name}-${item.lat}-${item.lng}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [fromStation, allCheckpoints, routes]);

  // Filter boarding suggestions based on search query
  const filteredFromSuggestions = useMemo(() => {
    const query = fromQuery.toLowerCase().trim();
    if (!query) return allCheckpoints;
    return allCheckpoints.filter(
      (cp) =>
        cp.name.toLowerCase().includes(query) ||
        cp.nameAr.toLowerCase().includes(query) ||
        cp.city.toLowerCase().includes(query)
    );
  }, [fromQuery, allCheckpoints]);

  // Filter destination suggestions based on search query
  const filteredToSuggestions = useMemo(() => {
    const query = toQuery.toLowerCase().trim();
    const sourceList = fromStation ? reachableDropoffStations : allCheckpoints;
    if (!query) return sourceList;
    return sourceList.filter(
      (cp) =>
        cp.name.toLowerCase().includes(query) ||
        cp.nameAr.toLowerCase().includes(query) ||
        cp.city.toLowerCase().includes(query)
    );
  }, [toQuery, fromStation, reachableDropoffStations, allCheckpoints]);

  const handleSwap = () => {
    setIsSwapped(prev => !prev);
    setShakeFields(true);
    setTimeout(() => setShakeFields(false), 300);

    const tempStation = fromStation;
    const tempQuery = fromQuery;

    setFromStation(toStation);
    setFromQuery(toQuery);
    setToStation(tempStation);
    setToQuery(tempQuery);
  };

  const canSearch = fromStation && toStation;

  const handleSearch = () => {
    if (canSearch) {
      const pickupLat = fromStation.lat;
      const pickupLng = fromStation.lng;
      const dropoffLat = toStation.lat;
      const dropoffLng = toStation.lng;
      const pickupCity = fromStation.city;
      const dropoffCity = toStation.city;

      navigate(
        `/search?pickupLat=${pickupLat}&pickupLng=${pickupLng}&dropoffLat=${dropoffLat}&dropoffLng=${dropoffLng}&date=${travelDate}&passengers=${passengers}&pickupCity=${encodeURIComponent(pickupCity)}&dropoffCity=${encodeURIComponent(dropoffCity)}`
      );
    }
  };

  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocationNotice(isRtl ? "⚠️ تحديد الموقع الجغرافي غير مدعوم في متصفحك" : "⚠️ Geolocation is not supported by your browser");
      setTimeout(() => setLocationNotice(null), 5000);
      return;
    }
    setLocationLoading(true);
    setLocationNotice(isRtl ? "⏳ جاري تحديد موقعك..." : "⏳ Detecting your location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        if (allCheckpoints.length === 0) {
          setLocationNotice(isRtl ? "⚠️ لا توجد محطات معرفة حالياً" : "⚠️ No stations defined in the platform currently.");
          setLocationLoading(false);
          setTimeout(() => setLocationNotice(null), 5000);
          return;
        }

        // Find nearest
        let nearestStation = allCheckpoints[0];
        let minDistance = getDistanceKm(latitude, longitude, nearestStation.lat, nearestStation.lng);

        for (let i = 1; i < allCheckpoints.length; i++) {
          const dist = getDistanceKm(latitude, longitude, allCheckpoints[i].lat, allCheckpoints[i].lng);
          if (dist < minDistance) {
            minDistance = dist;
            nearestStation = allCheckpoints[i];
          }
        }

        // Set state
        setFromStation(nearestStation);
        setFromQuery(isRtl ? (nearestStation.nameAr || nearestStation.name) : nearestStation.name);

        const matchedMsg = isRtl
          ? `📍 تم العثور على أقرب محطة: ${nearestStation.nameAr || nearestStation.name} في ${nearestStation.city} (على بعد ${minDistance.toFixed(2)} كم)`
          : `📍 Matched nearest station: ${nearestStation.name} in ${nearestStation.city} (${minDistance.toFixed(2)} km away)`;

        setLocationNotice(matchedMsg);
        setLocationLoading(false);
        setTimeout(() => setLocationNotice(null), 5000);
      },
      (error) => {
        setLocationNotice(isRtl ? `⚠️ فشل في تحديد الموقع: ${error.message}` : `⚠️ Failed to retrieve location: ${error.message}`);
        setLocationLoading(false);
        setTimeout(() => setLocationNotice(null), 5000);
      }
    );
  };

  // Click outside listener for inputs
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (fromRef.current && !fromRef.current.contains(e.target as Node)) {
        setFromFocused(false);
      }
      if (toRef.current && !toRef.current.contains(e.target as Node)) {
        setToFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const polylinePath: [number, number][] = [];
  if (fromStation) polylinePath.push([fromStation.lat, fromStation.lng]);
  if (toStation) polylinePath.push([toStation.lat, toStation.lng]);

  const groupedFrom = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredFromSuggestions.forEach(cp => {
      const city = cp.city || 'Other';
      if (!groups[city]) groups[city] = [];
      groups[city].push(cp);
    });
    return groups;
  }, [filteredFromSuggestions]);

  const groupedTo = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredToSuggestions.forEach(cp => {
      const city = cp.city || 'Other';
      if (!groups[city]) groups[city] = [];
      groups[city].push(cp);
    });
    return groups;
  }, [filteredToSuggestions]);

  return (
    <>
      <div className="from-to-container">
        {/* DETECT LOCATION & MAP ACTIONS */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: locationNotice ? '0.5rem' : '1rem' }}>
          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={locationLoading}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 14px',
              background: locationLoading ? 'rgba(245, 183, 49, 0.05)' : 'rgba(245, 183, 49, 0.1)',
              border: '1px dashed var(--primary)',
              borderRadius: '8px',
              color: 'var(--primary)',
              fontSize: '0.82rem',
              fontWeight: 'bold',
              cursor: locationLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: locationLoading ? 0.7 : 1
            }}
          >
            {locationLoading ? (
              <div className="btn-loading-spinner" />
            ) : (
              <MapPin size={14} />
            )}
            {isRtl ? 'تحديد أقرب محطة' : 'Detect Station'}
          </button>

          <button
            type="button"
            onClick={handleOpenMapPicker}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 14px',
              background: 'rgba(245, 183, 49, 0.1)',
              border: '1px solid var(--primary)',
              borderRadius: '8px',
              color: 'var(--primary)',
              fontSize: '0.82rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Map size={14} />
            {isRtl ? 'اختر على الخريطة' : 'Select on Map'}
          </button>
        </div>

        {/* GPS inline status banner */}
        {locationNotice && (
          <div className="fade-in-alert" style={{
            padding: '8px 12px',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            fontSize: '0.78rem',
            color: 'var(--text-primary)',
            marginBottom: '1rem',
            textAlign: 'center',
            fontWeight: 600,
          }}>
            {locationNotice}
          </div>
        )}

        {/* BOARDING (FROM) AUTOCOMPLETE */}
        <div className="from-to-row" style={{ position: 'relative', zIndex: 30 }} ref={fromRef}>
          <div className="from-to-field full-width">
            <label className="field-label">{isRtl ? 'من أين ستركب؟' : 'Where are you boarding?'}</label>
            <div className={`field-select-wrapper custom-select-container ${shakeFields ? 'shake-animation' : ''}`}>
              <MapPin size={16} className="field-icon-left" />
              <input
                type="text"
                className="field-input"
                placeholder={isRtl ? 'ابحث عن محطة ركوب...' : 'Search boarding stop...'}
                value={fromQuery}
                onFocus={() => {
                  setFromFocused(true);
                  setToFocused(false);
                }}
                onChange={(e) => {
                  setFromQuery(e.target.value);
                  if (fromStation && e.target.value !== (isRtl ? (fromStation.nameAr || fromStation.name) : fromStation.name)) {
                    setFromStation(null);
                  }
                }}
                style={{ paddingLeft: '36px', paddingRight: '36px' }}
              />
              {fromQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setFromQuery('');
                    setFromStation(null);
                  }}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={14} />
                </button>
              )}

              {fromFocused && (
                <div className="custom-dropdown-menu" style={{ width: '100%' }}>
                  {Object.keys(groupedFrom).length === 0 ? (
                    <div className="custom-dropdown-item" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
                      {isRtl ? 'لا توجد محطات مطابقة' : 'No matching stations'}
                    </div>
                  ) : (
                    Object.entries(groupedFrom).map(([city, items]) => (
                      <div key={city}>
                        <div style={{
                          padding: '6px 12px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          color: 'var(--primary)',
                          background: 'rgba(245, 183, 49, 0.05)',
                          borderBottom: '1px solid var(--border)',
                          letterSpacing: '0.05em'
                        }}>
                          🏙️ {city}
                        </div>
                        {items.map((cp: any) => (
                          <div
                            key={`${cp.name}-${cp.lat}-${cp.lng}-${cp.routeId}`}
                            className={`custom-dropdown-item ${fromStation?.name === cp.name ? 'selected' : ''}`}
                            onClick={() => {
                              setFromStation(cp);
                              setFromQuery(isRtl ? (cp.nameAr || cp.name) : cp.name);
                              setFromFocused(false);
                              // Trigger auto-focus / overlay on dropoff if empty
                              if (!toStation) {
                                setTimeout(() => setToFocused(true), 100);
                              }
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600 }}>{isRtl ? cp.nameAr : cp.name}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{cp.city}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SWAP BUTTON */}
        <div className="swap-button-container">
          <button type="button" className={`swap-button ${isSwapped ? 'swap-btn-rotated' : ''}`} onClick={handleSwap}>
            <ArrowUpDown size={16} />
          </button>
        </div>

        {/* DESTINATION (TO) AUTOCOMPLETE */}
        <div className="from-to-row" style={{ position: 'relative', zIndex: 20 }} ref={toRef}>
          <div className="from-to-field full-width">
            <label className="field-label">{isRtl ? 'إلى أين تريد الذهاب؟' : 'Where are you going?'}</label>
            <div className={`field-select-wrapper custom-select-container ${shakeFields ? 'shake-animation' : ''}`}>
              <MapPin size={16} className="field-icon-left" style={{ color: '#EF4444' }} />
              <input
                type="text"
                className="field-input"
                placeholder={
                  !fromStation
                    ? (isRtl ? 'اختر محطة الركوب أولاً' : 'Select boarding stop first')
                    : (isRtl ? 'ابحث عن وجهتك...' : 'Search destination stop...')
                }
                value={toQuery}
                onFocus={() => {
                  setToFocused(true);
                  setFromFocused(false);
                }}
                onChange={(e) => {
                  setToQuery(e.target.value);
                  if (toStation && e.target.value !== (isRtl ? (toStation.nameAr || toStation.name) : toStation.name)) {
                    setToStation(null);
                  }
                }}
                style={{ paddingLeft: '36px', paddingRight: '36px' }}
              />
              {toQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setToQuery('');
                    setToStation(null);
                  }}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={14} />
                </button>
              )}

              {toFocused && (
                <div className="custom-dropdown-menu" style={{ width: '100%' }}>
                  {!fromStation && (
                    <div className="custom-dropdown-item" style={{ color: 'var(--primary)', cursor: 'default', fontWeight: 600, fontSize: '0.8rem', textAlign: 'center', padding: '12px' }}>
                      {isRtl ? '⚠️ الرجاء اختيار محطة الركوب أولاً لمعرفة الوجهات المتاحة' : '⚠️ Please select a boarding stop first to see reachable destinations'}
                    </div>
                  )}
                  {fromStation && Object.keys(groupedTo).length === 0 ? (
                    <div className="custom-dropdown-item" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
                      {isRtl ? 'لا توجد محطات تالية متاحة' : 'No reachable stops found'}
                    </div>
                  ) : (
                    fromStation && Object.entries(groupedTo).map(([city, items]) => (
                      <div key={city}>
                        <div style={{
                          padding: '6px 12px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          color: '#EF4444',
                          background: 'rgba(239, 68, 68, 0.03)',
                          borderBottom: '1px solid var(--border)',
                          letterSpacing: '0.05em'
                        }}>
                          🏙️ {city}
                        </div>
                        {items.map((cp: any) => (
                          <div
                            key={`${cp.name}-${cp.lat}-${cp.lng}-${cp.routeId}`}
                            className={`custom-dropdown-item ${toStation?.name === cp.name ? 'selected' : ''}`}
                            onClick={() => {
                              setToStation(cp);
                              setToQuery(isRtl ? (cp.nameAr || cp.name) : cp.name);
                              setToFocused(false);
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600 }}>{isRtl ? cp.nameAr : cp.name}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{cp.city}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ROW 3: DATE */}
        <div className="from-to-row">
          <div className="from-to-field full-width">
            <label className="field-label">Travel Date</label>
            <div className="field-select-wrapper">
              <Calendar size={16} className="field-icon-left" />
              <input
                type="date"
                value={travelDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setTravelDate(e.target.value)}
                className="field-input"
              />
            </div>
          </div>
        </div>

        {/* ROW 4: PASSENGERS */}
        <div className="from-to-row">
          <div className="from-to-field full-width">
            <label className="field-label">Number of Seats</label>
            <div className="passenger-selector">
              <Users size={16} className="field-icon-left" style={{ color: 'var(--primary)', position: 'static' }} />
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  flex: 1,
                  textAlign: 'left',
                  marginLeft: '8px',
                }}
              >
                {passengers} {passengers === 1 ? 'Seat' : 'Seats'}
              </span>
              <div className="passenger-controls">
                <button
                  type="button"
                  onClick={() => setPassengers((p) => Math.max(1, p - 1))}
                  className="passenger-control-btn"
                  disabled={passengers <= 1}
                >
                  -
                </button>
                <span className="passenger-count">{passengers}</span>
                <button
                  type="button"
                  onClick={() => setPassengers((p) => Math.min(10, p + 1))}
                  className="passenger-control-btn"
                  disabled={passengers >= 10}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>



      <button
        className="search-btn"
        onClick={handleSearch}
        disabled={!canSearch}
        id="search-trips-btn"
        style={{ marginTop: '0.5rem' }}
      >
        Show Trips <Search size={18} />
      </button>

      {/* Fallback to manual route selection */}
      <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
        <Link
          to="/routes"
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          Or browse all routes manually →
        </Link>
      </div>

      {isMapModalOpen && mapPickerCoords && (
        <div className="map-picker-overlay" onClick={() => setIsMapModalOpen(false)}>
          <div className="map-picker-content" onClick={(e) => e.stopPropagation()}>
            <div className="map-picker-header">
              <h3 className="map-picker-title">
                {isRtl ? 'اختر موقع الركوب على الخريطة' : 'Select Pickup Location on Map'}
              </h3>
              <button className="map-picker-close" onClick={() => setIsMapModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="map-picker-container">
              <MapContainer
                center={mapPickerCoords}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                <Marker 
                  position={mapPickerCoords}
                  draggable={true}
                  eventHandlers={{
                    dragend: handleMarkerDragEnd
                  }}
                >
                  <Popup>
                    {isRtl ? 'اسحب الدبوس لتحديد موقع الركوب' : 'Drag this pin to your pickup point'}
                  </Popup>
                </Marker>

                <MapClickHandler onClick={handleMapClick} />
              </MapContainer>
            </div>

            {nearestStationFromMap ? (
              <div className="map-picker-info">
                <span className="map-picker-info-label">
                  {isRtl ? 'أقرب محطة ركوب مطابقة' : 'Nearest Matched Station'}
                </span>
                <span className="map-picker-info-value">
                  {isRtl 
                    ? (nearestStationFromMap.checkpoint.nameAr || nearestStationFromMap.checkpoint.name)
                    : nearestStationFromMap.checkpoint.name
                  } 
                  <span style={{ opacity: 0.6, fontSize: '0.8em', marginLeft: '6px' }}>
                    ({isRtl ? 'على بعد' : ''} {nearestStationFromMap.distanceMeters} {isRtl ? 'متر' : 'meters away'})
                  </span>
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {isRtl ? 'الخط' : 'Route'}: {nearestStationFromMap.route.name}
                </span>
              </div>
            ) : (
              <div className="map-picker-info" style={{ borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }}>
                <span className="map-picker-info-value" style={{ color: '#ef4444' }}>
                  {isRtl ? '⚠️ لا توجد محطات قريبة في النطاق' : '⚠️ No stations found nearby.'}
                </span>
              </div>
            )}

            <div className="map-picker-actions">
              <button 
                className="map-picker-btn-cancel" 
                onClick={() => setIsMapModalOpen(false)}
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                className="map-picker-btn-confirm" 
                onClick={handleConfirmMapSelection}
                disabled={!nearestStationFromMap || mapLoading}
              >
                {mapLoading ? (
                  <div className="btn-loading-spinner" />
                ) : (
                  <MapPin size={16} />
                )}
                {isRtl ? 'تأكيد محطة الركوب' : 'Confirm Pickup Station'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const [partners, setPartners] = useState<any[]>([]);

  useEffect(() => {
    partnersAPI.getActive()
      .then(data => setPartners(data))
      .catch(console.error);
  }, []);

  return (
    <>
      {/* ── Hero Section ─────────────────────────────────── */}
      <section className="hero-section" id="hero">
        <div className="hero-bg-gradient" />
        <div className="hero-bg-gradient-2" />

        <div className="hero-content">
          <div className="hero-text">
            <div className="hero-badge">
              <span className="hero-badge-dot" />
              Live Route Telemetry Enabled
            </div>
            <h1 className="hero-title">
              Your Daily<br />
              Commute,{' '}
              <span className="hero-title-accent">Reinvented.</span>
            </h1>
            <p className="hero-subtitle">
              Smart mass-transit for Cairo and beyond. Book your seat on
              comfortable, air-conditioned buses with fixed routes,
              real-time tracking, and cashless payments.
            </p>
            <div className="hero-actions">
              {isAuthenticated ? (
                <Link to="/my-trips" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Ticket size={20} /> My Trips
                </Link>
              ) : (
                <Link to="/register" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Bus size={20} /> Book a Ride
                </Link>
              )}
              <a href="#how-it-works" className="btn-secondary">
                Learn More →
              </a>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-card glass">
              <div className="hero-card-header">
                <div className="hero-card-icon"><MapPin size={24} /></div>
                <div>
                  <div className="hero-card-title">Find Your Route</div>
                  <div className="hero-card-subtitle">Select your destination</div>
                </div>
              </div>
              <RouteSearchForm />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ────────────────────────────────────── */}
      <div className="stats-bar">
        <div className="stat-card glass delay-1 animate-fade-in-up">
          <div className="stat-value">150+</div>
          <div className="stat-label">Daily Routes</div>
        </div>
        <div className="stat-card glass delay-2 animate-fade-in-up">
          <div className="stat-value">50K+</div>
          <div className="stat-label">Happy Riders</div>
        </div>
        <div className="stat-card glass delay-3 animate-fade-in-up">
          <div className="stat-value">200+</div>
          <div className="stat-label">Vehicles</div>
        </div>
        <div className="stat-card glass delay-4 animate-fade-in-up">
          <div className="stat-value">4.8⭐</div>
          <div className="stat-label">Avg Rating</div>
        </div>
      </div>

      {/* ── How It Works ─────────────────────────────────── */}
      <section className="section" id="how-it-works">
        <div className="section-header">
          <div className="section-badge">Simple & Fast</div>
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">
            Get from A to B in three simple steps. No haggling, no uncertainty — just a smooth, reliable commute.
          </p>
        </div>

        <div className="steps-grid">
          <div className="step-card glass delay-1 animate-fade-in-up">
            <div className="step-number">1</div>
            <div className="step-icon"><Search size={32} /></div>
            <h3 className="step-title">Search</h3>
            <p className="step-desc">
              Enter your pickup and destination. We'll show you the best available routes with live ETAs.
            </p>
          </div>
          <div className="step-card glass delay-2 animate-fade-in-up">
            <div className="step-number">2</div>
            <div className="step-icon"><Ticket size={32} /></div>
            <h3 className="step-title">Book</h3>
            <p className="step-desc">
              Select your preferred trip and pay securely through our integrated Paymob checkout. Instant confirmation.
            </p>
          </div>
          <div className="step-card glass delay-3 animate-fade-in-up">
            <div className="step-number">3</div>
            <div className="step-icon"><Bus size={32} /></div>
            <h3 className="step-title">Ride</h3>
            <p className="step-desc">
              Track your bus in real-time, board with your digital ticket, and enjoy a comfortable air-conditioned ride.
            </p>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────── */}
      <section className="section" id="features">
        <div className="section-header">
          <div className="section-badge">Why D-Ride</div>
          <h2 className="section-title">Built for Cairo's Streets</h2>
          <p className="section-subtitle">
            We understand the Egyptian commute. That's why every feature is designed to make your daily journey better.
          </p>
        </div>

        <div className="features-grid">
          <div className="feature-card glass delay-1 animate-fade-in-up">
            <div className="feature-icon"><MapPin size={28} /></div>
            <div>
              <h3 className="feature-title">Real-Time GPS Tracking</h3>
              <p className="feature-desc">
                Know exactly where your bus is. Live location updates every few seconds so you never miss your ride.
              </p>
            </div>
          </div>
          <div className="feature-card glass delay-2 animate-fade-in-up">
            <div className="feature-icon"><CreditCard size={28} /></div>
            <div>
              <h3 className="feature-title">Card & Cash Payments</h3>
              <p className="feature-desc">
                Pay securely online with cards through our Paymob integration, or pay in cash directly on board the bus.
              </p>
            </div>
          </div>
          <div className="feature-card glass delay-3 animate-fade-in-up">
            <div className="feature-icon"><Snowflake size={28} /></div>
            <div>
              <h3 className="feature-title">Comfort Guaranteed</h3>
              <p className="feature-desc">
                Air-conditioned vehicles, reserved seats, and a guaranteed boarding experience. No standing, no crowding.
              </p>
            </div>
          </div>
          <div className="feature-card glass delay-4 animate-fade-in-up">
            <div className="feature-icon"><Zap size={28} /></div>
            <div>
              <h3 className="feature-title">Fixed Pricing</h3>
              <p className="feature-desc">
                Transparent, fixed pricing for every route. Know exactly what you'll pay before you book — no surge pricing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Partners Section ──────────────────────────────── */}
      {partners.length > 0 && (
        <section className="section" id="partners" style={{ paddingBottom: '3rem' }}>
          <div className="section-header">
            <div className="section-badge">Trusted Collaborations</div>
            <h2 className="section-title">Our Partners</h2>
            <p className="section-subtitle">
              We work in partnership with Egypt's leading organizations, universities, and payment networks to deliver a seamless journey.
            </p>
          </div>

          <div className="partner-grid">
            {partners.map((partner) => {
              const hasLink = !!partner.websiteUrl;
              return hasLink ? (
                <a
                  key={partner._id || partner.id}
                  href={partner.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="partner-card has-link"
                >
                  <Globe size={14} className="partner-link-indicator" />
                  <div className="partner-logo-wrapper">
                    <img
                      src={cleanGoogleDriveLink(partner.logoUrl)}
                      alt={partner.name}
                      className="partner-logo"
                    />
                  </div>
                  <span className="partner-name">{partner.name}</span>
                </a>
              ) : (
                <div
                  key={partner._id || partner.id}
                  className="partner-card"
                >
                  <div className="partner-logo-wrapper">
                    <img
                      src={cleanGoogleDriveLink(partner.logoUrl)}
                      alt={partner.name}
                      className="partner-logo"
                    />
                  </div>
                  <span className="partner-name">{partner.name}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <img src={logo} alt="D-Ride" className="footer-logo" />
            <span className="footer-tagline">Operated by Destination</span>
          </div>
          <ul className="footer-links">
            <li><a href="#">About</a></li>
            <li><a href="#">Terms</a></li>
            <li><a href="#">Privacy</a></li>
            <li><a href="#">Contact</a></li>
          </ul>
          <span className="footer-copyright">© 2026 D-Ride. All rights reserved.</span>
        </div>
      </footer>
    </>
  );
}
