import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { routesAPI, partnersAPI } from '../services/api';
import logo from '../assets/d-ride-logo.jpeg';
import { Map, MapPin, Search, Ticket, Bus, CreditCard, Snowflake, Zap, Calendar, Users, ArrowUpDown, X } from 'lucide-react';

import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet';
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

// Autopan hook to fit the polyline path perfectly
function RouteMapAutopan({ path }: { path: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (path.length > 0) {
      const bounds = L.latLngBounds(path);
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [path, map]);
  return null;
}

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
  const [fromCity, setFromCity] = useState<string>('');
  const [fromStation, setFromStation] = useState<any>(null);
  const [toCity, setToCity] = useState<string>('');
  const [toStation, setToStation] = useState<any>(null);
  const [travelDate, setTravelDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [passengers, setPassengers] = useState<number>(1);
  const navigate = useNavigate();

  // Custom states for premium dropdown UX
  const [openDropdown, setOpenDropdown] = useState<'fromCity' | 'fromStation' | 'toCity' | 'toStation' | null>(null);
  const [isSwapped, setIsSwapped] = useState(false);
  const [shakeFields, setShakeFields] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState<boolean>(false);

  // Autocomplete Filter States
  const [fromStationSearch, setFromStationSearch] = useState('');
  const [toStationSearch, setToStationSearch] = useState('');

  useEffect(() => {
    if (openDropdown !== 'fromStation') {
      setFromStationSearch('');
    }
    if (openDropdown !== 'toStation') {
      setToStationSearch('');
    }
  }, [openDropdown]);

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
      const routeName = nearestStationFromMap.route.name;
      const parts = routeName.split(/\s+to\s+/i);
      const fromC = parts.length >= 1 ? parts[0].trim() : '';
      const city = fromC.charAt(0).toUpperCase() + fromC.slice(1);
      
      setFromCity(city);
      setFromStation({
        name: cp.name,
        nameAr: cp.nameAr,
        lat: cp.location.coordinates[1],
        lng: cp.location.coordinates[0],
        routeId: nearestStationFromMap.route.id
      });
      setIsMapModalOpen(false);
    }
  };

  // Load all routes to extract cities and stations
  useEffect(() => {
    routesAPI.getAll().then((data) => setRoutes(data)).catch(console.error);
  }, []);

  // Click outside to close custom select dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (openDropdown && !(e.target as HTMLElement).closest('.custom-select-container')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openDropdown]);

  // Parse cities and stations from routes list
  const parsedData = useMemo(() => {
    const fromCitiesSet = new Set<string>();
    const toCitiesSet = new Set<string>();
    const fromStationsMap: Record<string, any[]> = {};
    const toStationsMap: Record<string, any[]> = {};

    routes.forEach((route) => {
      const parts = route.name.split(/\s+to\s+/i);
      if (parts.length < 2) return;
      const fromC = parts[0].trim();
      const toC = parts[1].trim();

      const fCity = fromC.charAt(0).toUpperCase() + fromC.slice(1);
      const tCity = toC.charAt(0).toUpperCase() + toC.slice(1);

      fromCitiesSet.add(fCity);
      toCitiesSet.add(tCity);

      if (!fromStationsMap[fCity]) fromStationsMap[fCity] = [];
      if (!toStationsMap[tCity]) toStationsMap[tCity] = [];

      const checkpoints = route.checkpoints || [];
      if (checkpoints.length >= 2) {
        const mid = Math.ceil(checkpoints.length / 2);
        checkpoints.forEach((cp: any, idx: number) => {
          const coords = cp.location?.coordinates;
          if (!coords) return;
          const station = {
            name: cp.name,
            nameAr: cp.nameAr,
            lat: coords[1],
            lng: coords[0],
            routeId: route._id || route.id,
          };
          if (idx < mid) {
            if (!fromStationsMap[fCity].some((s) => s.name === station.name)) {
              fromStationsMap[fCity].push(station);
            }
          } else {
            if (!toStationsMap[tCity].some((s) => s.name === station.name)) {
              toStationsMap[tCity].push(station);
            }
          }
        });
      } else {
        const coords = route.path?.coordinates || [];
        if (coords.length >= 2) {
          const startCoords = coords[0];
          const endCoords = coords[coords.length - 1];

          const startStation = {
            name: `${fCity} Start Point`,
            lat: startCoords[1],
            lng: startCoords[0],
            routeId: route._id || route.id,
          };
          const endStation = {
            name: `${tCity} End Point`,
            lat: endCoords[1],
            lng: endCoords[0],
            routeId: route._id || route.id,
          };

          if (!fromStationsMap[fCity].some((s) => s.name === startStation.name)) {
            fromStationsMap[fCity].push(startStation);
          }
          if (!toStationsMap[tCity].some((s) => s.name === endStation.name)) {
            toStationsMap[tCity].push(endStation);
          }
        }
      }
    });

    return {
      fromCities: Array.from(fromCitiesSet),
      toCities: Array.from(toCitiesSet),
      fromStationsMap,
      toStationsMap,
    };
  }, [routes]);

  const availableFromStations = fromCity ? (parsedData.fromStationsMap[fromCity] || []) : [];
  const availableToStations = toCity ? (parsedData.toStationsMap[toCity] || []) : [];

  const handleFromCityChange = (city: string) => {
    setFromCity(city);
    const stations = parsedData.fromStationsMap[city] || [];
    if (stations.length > 0) {
      setFromStation(stations[0]);
    } else {
      setFromStation(null);
    }
  };

  const handleToCityChange = (city: string) => {
    setToCity(city);
    const stations = parsedData.toStationsMap[city] || [];
    if (stations.length > 0) {
      setToStation(stations[0]);
    } else {
      setToStation(null);
    }
  };

  const handleFromStationChange = (stationName: string) => {
    const station = availableFromStations.find((s) => s.name === stationName);
    setFromStation(station || null);
  };

  const handleToStationChange = (stationName: string) => {
    const station = availableToStations.find((s) => s.name === stationName);
    setToStation(station || null);
  };

  const handleSwap = () => {
    setIsSwapped(prev => !prev);
    setShakeFields(true);
    setTimeout(() => setShakeFields(false), 300);

    const tempCity = fromCity;
    const tempStation = fromStation;
    setFromCity(toCity);
    setFromStation(toStation);
    setToCity(tempCity);
    setToStation(tempStation);
  };

  const canSearch = fromCity && fromStation && toCity && toStation;

  const handleSearch = () => {
    if (canSearch) {
      const pickupLat = fromStation.lat;
      const pickupLng = fromStation.lng;
      const dropoffLat = toStation.lat;
      const dropoffLng = toStation.lng;
      
      navigate(
        `/search?pickupLat=${pickupLat}&pickupLng=${pickupLng}&dropoffLat=${dropoffLat}&dropoffLng=${dropoffLng}&date=${travelDate}&passengers=${passengers}`
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
        
        // Flatten all stations
        const allFromStations: any[] = [];
        Object.entries(parsedData.fromStationsMap).forEach(([city, stations]) => {
          stations.forEach((station: any) => {
            allFromStations.push({ ...station, city });
          });
        });

        if (allFromStations.length === 0) {
          setLocationNotice(isRtl ? "⚠️ لا توجد محطات معرفة حالياً" : "⚠️ No stations defined in the platform currently.");
          setLocationLoading(false);
          setTimeout(() => setLocationNotice(null), 5000);
          return;
        }

        // Find nearest
        let nearestStation = allFromStations[0];
        let minDistance = getDistanceKm(latitude, longitude, nearestStation.lat, nearestStation.lng);

        for (let i = 1; i < allFromStations.length; i++) {
          const dist = getDistanceKm(latitude, longitude, allFromStations[i].lat, allFromStations[i].lng);
          if (dist < minDistance) {
            minDistance = dist;
            nearestStation = allFromStations[i];
          }
        }

        // Set state
        setFromCity(nearestStation.city);
        setFromStation(nearestStation);
        
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

  const polylinePath: [number, number][] = [];
  if (fromStation) polylinePath.push([fromStation.lat, fromStation.lng]);
  if (toStation) polylinePath.push([toStation.lat, toStation.lng]);

  return (
    <>
      <div className="from-to-container">
        {/* DETECT LOCATION ACTION */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: locationNotice ? '0.5rem' : '1rem' }}>
          {/* DETECT LOCATION ACTION */}
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
            onMouseEnter={(e) => {
              if (!locationLoading) e.currentTarget.style.background = 'rgba(245, 183, 49, 0.18)';
            }}
            onMouseLeave={(e) => {
              if (!locationLoading) e.currentTarget.style.background = 'rgba(245, 183, 49, 0.1)';
            }}
          >
            {locationLoading ? (
              <div className="btn-loading-spinner" />
            ) : (
              <MapPin size={14} />
            )}
            {isRtl ? 'تحديد أقرب محطة' : 'Detect Station'}
          </button>

          {/* SELECT ON MAP ACTION */}
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
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(245, 183, 49, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(245, 183, 49, 0.1)';
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

        {/* ROW 1: FROM */}
        <div className="from-to-row">
          <div className="from-to-field">
            <label className="field-label">{isRtl ? 'من مدينة' : 'From City'}</label>
            <div className={`field-select-wrapper custom-select-container ${shakeFields ? 'shake-animation' : ''}`}>
              <MapPin size={16} className="field-icon-left" />
              <div 
                className="custom-select-trigger"
                onClick={() => setOpenDropdown(openDropdown === 'fromCity' ? null : 'fromCity')}
              >
                <span>{fromCity || (isRtl ? 'اختر المدينة' : 'Select City')}</span>
                <span style={{ fontSize: '8px', opacity: 0.6, transform: openDropdown === 'fromCity' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
              </div>
              {openDropdown === 'fromCity' && (
                <div className="custom-dropdown-menu">
                  <div 
                    className="custom-dropdown-item"
                    onClick={() => {
                      handleFromCityChange('');
                      setOpenDropdown(null);
                    }}
                  >
                    {isRtl ? 'اختر المدينة' : 'Select City'}
                  </div>
                  {parsedData.fromCities.map((city) => (
                    <div 
                      key={city}
                      className={`custom-dropdown-item ${fromCity === city ? 'selected' : ''}`}
                      onClick={() => {
                        handleFromCityChange(city);
                        setOpenDropdown(null);
                      }}
                    >
                      {city}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="from-to-field">
            <label className="field-label">{isRtl ? 'من محطة' : 'From Station'}</label>
            <div className={`field-select-wrapper custom-select-container ${shakeFields ? 'shake-animation' : ''}`} style={{ opacity: !fromCity ? 0.6 : 1 }}>
              <Map size={16} className="field-icon-left" />
              <div 
                className="custom-select-trigger"
                onClick={() => {
                  if (fromCity) {
                    setOpenDropdown(openDropdown === 'fromStation' ? null : 'fromStation');
                  }
                }}
                style={{ cursor: !fromCity ? 'not-allowed' : 'pointer' }}
              >
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                  {fromStation 
                    ? (isRtl ? (fromStation.nameAr || fromStation.name) : fromStation.name)
                    : (isRtl ? 'اختر المحطة' : 'Select Station')
                  }
                </span>
                <span style={{ fontSize: '8px', opacity: 0.6, transform: openDropdown === 'fromStation' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
              </div>
              {openDropdown === 'fromStation' && fromCity && (
                <div className="custom-dropdown-menu">
                  <input
                    type="text"
                    placeholder={isRtl ? "ابحث عن محطة..." : "Search station..."}
                    value={fromStationSearch}
                    onChange={(e) => setFromStationSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="dropdown-search-input"
                    style={{
                      width: 'calc(100% - 16px)',
                      margin: '8px',
                      padding: '8px 10px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                      outline: 'none'
                    }}
                  />
                  <div 
                    className="custom-dropdown-item"
                    onClick={() => {
                      setFromStation(null);
                      setOpenDropdown(null);
                    }}
                  >
                    {isRtl ? 'اختر المحطة' : 'Select Station'}
                  </div>
                  {availableFromStations
                    .filter(station => {
                      const query = fromStationSearch.toLowerCase();
                      return (
                        station.name.toLowerCase().includes(query) ||
                        (station.nameAr && station.nameAr.includes(query))
                      );
                    })
                    .map((station) => (
                      <div 
                        key={station.name}
                        className={`custom-dropdown-item ${fromStation?.name === station.name ? 'selected' : ''}`}
                        onClick={() => {
                          handleFromStationChange(station.name);
                          setOpenDropdown(null);
                        }}
                      >
                        {isRtl ? (station.nameAr || station.name) : station.name}
                      </div>
                    ))
                  }
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

        {/* ROW 2: TO */}
        <div className="from-to-row">
          <div className="from-to-field">
            <label className="field-label">{isRtl ? 'إلى مدينة' : 'To City'}</label>
            <div className={`field-select-wrapper custom-select-container ${shakeFields ? 'shake-animation' : ''}`}>
              <MapPin size={16} className="field-icon-left" style={{ color: '#EF4444' }} />
              <div 
                className="custom-select-trigger"
                onClick={() => setOpenDropdown(openDropdown === 'toCity' ? null : 'toCity')}
              >
                <span>{toCity || (isRtl ? 'اختر المدينة' : 'Select City')}</span>
                <span style={{ fontSize: '8px', opacity: 0.6, transform: openDropdown === 'toCity' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
              </div>
              {openDropdown === 'toCity' && (
                <div className="custom-dropdown-menu">
                  <div 
                    className="custom-dropdown-item"
                    onClick={() => {
                      handleToCityChange('');
                      setOpenDropdown(null);
                    }}
                  >
                    {isRtl ? 'اختر المدينة' : 'Select City'}
                  </div>
                  {parsedData.toCities.map((city) => (
                    <div 
                      key={city}
                      className={`custom-dropdown-item ${toCity === city ? 'selected' : ''}`}
                      onClick={() => {
                        handleToCityChange(city);
                        setOpenDropdown(null);
                      }}
                    >
                      {city}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="from-to-field">
            <label className="field-label">{isRtl ? 'إلى محطة' : 'To Station'}</label>
            <div className={`field-select-wrapper custom-select-container ${shakeFields ? 'shake-animation' : ''}`} style={{ opacity: !toCity ? 0.6 : 1 }}>
              <Map size={16} className="field-icon-left" style={{ color: '#EF4444' }} />
              <div 
                className="custom-select-trigger"
                onClick={() => {
                  if (toCity) {
                    setOpenDropdown(openDropdown === 'toStation' ? null : 'toStation');
                  }
                }}
                style={{ cursor: !toCity ? 'not-allowed' : 'pointer' }}
              >
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                  {toStation 
                    ? (isRtl ? (toStation.nameAr || toStation.name) : toStation.name)
                    : (isRtl ? 'اختر المحطة' : 'Select Station')
                  }
                </span>
                <span style={{ fontSize: '8px', opacity: 0.6, transform: openDropdown === 'toStation' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
              </div>
              {openDropdown === 'toStation' && toCity && (
                <div className="custom-dropdown-menu">
                  <input
                    type="text"
                    placeholder={isRtl ? "ابحث عن محطة..." : "Search station..."}
                    value={toStationSearch}
                    onChange={(e) => setToStationSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="dropdown-search-input"
                    style={{
                      width: 'calc(100% - 16px)',
                      margin: '8px',
                      padding: '8px 10px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                      outline: 'none'
                    }}
                  />
                  <div 
                    className="custom-dropdown-item"
                    onClick={() => {
                      setToStation(null);
                      setOpenDropdown(null);
                    }}
                  >
                    {isRtl ? 'اختر المحطة' : 'Select Station'}
                  </div>
                  {availableToStations
                    .filter(station => {
                      const query = toStationSearch.toLowerCase();
                      return (
                        station.name.toLowerCase().includes(query) ||
                        (station.nameAr && station.nameAr.includes(query))
                      );
                    })
                    .map((station) => (
                      <div 
                        key={station.name}
                        className={`custom-dropdown-item ${toStation?.name === station.name ? 'selected' : ''}`}
                        onClick={() => {
                          handleToStationChange(station.name);
                          setOpenDropdown(null);
                        }}
                      >
                        {isRtl ? (station.nameAr || station.name) : station.name}
                      </div>
                    ))
                  }
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

      {/* Mini map preview when both pins are set */}
      {fromStation && toStation && (
        <div
          style={{
            height: '180px',
            borderRadius: '12px',
            overflow: 'hidden',
            margin: '1rem 0',
            border: '1px solid var(--border)',
            zIndex: 1,
          }}
        >
          <MapContainer
            center={[(fromStation.lat + toStation.lat) / 2, (fromStation.lng + toStation.lng) / 2]}
            zoom={11}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[fromStation.lat, fromStation.lng]}>
              <Popup>📍 Pickup: {fromStation.name}</Popup>
            </Marker>
            <Marker position={[toStation.lat, toStation.lng]}>
              <Popup>🏁 Dropoff: {toStation.name}</Popup>
            </Marker>
            <Polyline
              positions={[
                [fromStation.lat, fromStation.lng],
                [toStation.lat, toStation.lng],
              ]}
              color="var(--primary)"
              weight={3}
              dashArray="8 6"
              opacity={0.6}
            />
            <RouteMapAutopan
              path={[
                [fromStation.lat, fromStation.lng],
                [toStation.lat, toStation.lng],
              ]}
            />
          </MapContainer>
        </div>
      )}

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

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '30px',
            marginTop: '2rem'
          }}>
            {partners.map((partner) => (
              <a
                key={partner._id || partner.id}
                href={partner.websiteUrl || '#'}
                target={partner.websiteUrl ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="glass"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                  borderRadius: '16px',
                  width: '180px',
                  height: '140px',
                  transition: 'all 0.3s ease',
                  cursor: partner.websiteUrl ? 'pointer' : 'default',
                  textDecoration: 'none',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(245, 183, 49, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                <img
                  src={cleanGoogleDriveLink(partner.logoUrl)}
                  alt={partner.name}
                  style={{
                    maxWidth: '80px',
                    maxHeight: '60px',
                    objectFit: 'contain',
                    marginBottom: '12px',
                    filter: 'grayscale(30%) contrast(90%) brightness(95%)',
                    transition: 'filter 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.filter = 'grayscale(0%) contrast(100%) brightness(100%)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = 'grayscale(30%) contrast(90%) brightness(95%)';
                  }}
                />
                <span style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  textAlign: 'center'
                }}>
                  {partner.name}
                </span>
              </a>
            ))}
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
