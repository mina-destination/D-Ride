import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { routesAPI, tripsAPI } from '../services/api';
import logo from '../assets/d-ride-logo.jpeg';
import { Map, MapPin, Search, Ticket, Bus, CreditCard, Snowflake, Zap, Users, ArrowUpDown, X } from 'lucide-react';
import SEO from '../components/SEO';
import { CustomDatePicker } from '../components/CustomDatePicker';

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from '../context/ThemeContext';

function RouteSearchForm() {
  const { t, isRtl } = useTranslation();
  const { theme } = useTheme();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [fromStation, setFromStation] = useState<any>(null);
  const [toStation, setToStation] = useState<any>(null);
  const [travelDate, setTravelDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const todayLocalStr = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);
  const [passengers, setPassengers] = useState<number>(1);
  const [maxAvailableSeats, setMaxAvailableSeats] = useState<number>(10);
  const [isFetchingLimit, setIsFetchingLimit] = useState<boolean>(false);
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

  // Debounced queries for Nominatim geocoding search
  const [debouncedFromQuery, setDebouncedFromQuery] = useState('');
  const [debouncedToQuery, setDebouncedToQuery] = useState('');
  const [nominatimFromResults, setNominatimFromResults] = useState<any[]>([]);
  const [nominatimToResults, setNominatimToResults] = useState<any[]>([]);
  const [nominatimLoading, setNominatimLoading] = useState(false);
  // Keyboard navigation active index
  const [fromActiveIndex, setFromActiveIndex] = useState(0);
  const [toActiveIndex, setToActiveIndex] = useState(0);
  const fromInputRef = useRef<HTMLInputElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);

  // Map modal states
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [mapPickerCoords, setMapPickerCoords] = useState<[number, number] | null>(null);

  // Fetch dynamic capacity limit based on route and date
  useEffect(() => {
    if (fromStation && toStation && travelDate) {
      const routeId = fromStation.routeId;
      if (routeId) {
        setIsFetchingLimit(true);
        tripsAPI.search(routeId, travelDate)
          .then((tripsList: any[]) => {
            if (Array.isArray(tripsList) && tripsList.length > 0) {
              const maxSeats = Math.max(...tripsList.map(trip => {
                const lockedCount = trip.lockedSeats ? trip.lockedSeats.length : 0;
                const seatsLeft = trip.availableSeats - trip.bookedSeats - lockedCount;
                return Math.max(0, seatsLeft);
              }));
              // If there is capacity, cap the passenger counter at the maximum available seats, otherwise fallback to 10
              setMaxAvailableSeats(maxSeats > 0 ? maxSeats : 10);
            } else {
              setMaxAvailableSeats(10); // Default fallback if no trips are scheduled yet
            }
          })
          .catch(err => {
            console.error('Failed to fetch seat limit:', err);
            setMaxAvailableSeats(10); // Safe fallback
          })
          .finally(() => {
            setIsFetchingLimit(false);
          });
      }
    } else {
      setMaxAvailableSeats(10); // Standard limit when fields are incomplete
    }
  }, [fromStation, toStation, travelDate]);

  // Clamp current selection if it exceeds the dynamic limit
  useEffect(() => {
    if (passengers > maxAvailableSeats) {
      setPassengers(Math.max(1, maxAvailableSeats));
    }
  }, [maxAvailableSeats, passengers]);
  const [nearestStationFromMap, setNearestStationFromMap] = useState<any>(null);
  const [mapLoading, setMapLoading] = useState(false);

  const fetchNearestStationForCoords = async (coords: [number, number]) => {
    try {
      setMapLoading(true);
      const results = await routesAPI.getNearestStation(coords[0], coords[1], 1);
      if (Array.isArray(results) && results.length > 0) {
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


  const handleConfirmMapSelection = () => {
    if (nearestStationFromMap && mapPickerCoords) {
      const cp = nearestStationFromMap.checkpoint;
      const route = nearestStationFromMap.route;
      const parts = route.name.split(/\s+to\s+/i);
      const fromC = parts.length >= 1 ? parts[0].trim() : '';
      const city = cp.city || fromC.charAt(0).toUpperCase() + fromC.slice(1);

      const station = {
        name: cp.name,
        nameAr: cp.nameAr,
        lat: mapPickerCoords[0],
        lng: mapPickerCoords[1],
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
    routesAPI.getAll()
      .then((data) => {
        if (Array.isArray(data)) {
          setRoutes(data);
        } else {
          setRoutes([]);
        }
      })
      .catch(err => {
        console.error('Failed to load routes:', err);
        setRoutes([]);
      });
  }, []);

  useEffect(() => {
    if (!isMapModalOpen || !mapPickerCoords || !mapContainerRef.current) return;

    // MapLibre uses [lng, lat]
    const centerCoords: [number, number] = [mapPickerCoords[1], mapPickerCoords[0]];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: theme === 'dark' ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/bright',
      center: centerCoords,
      zoom: 13,
      attributionControl: false
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

    // Create a custom draggable marker element
    const el = document.createElement('div');
    el.style.width = '20px';
    el.style.height = '20px';
    el.style.borderRadius = '50%';
    el.style.backgroundColor = '#f5b731'; // D-Ride Amber
    el.style.border = '3px solid white';
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    el.style.cursor = 'grab';

    const marker = new maplibregl.Marker({
      element: el,
      draggable: true
    })
      .setLngLat(centerCoords)
      .addTo(map);

    markerRef.current = marker;

    // Listen to dragend
    marker.on('dragend', async () => {
      const lngLat = marker.getLngLat();
      const coords: [number, number] = [lngLat.lat, lngLat.lng];
      setMapPickerCoords(coords);
      await fetchNearestStationForCoords(coords);
    });

    // Listen to map click
    map.on('click', async (e) => {
      const coords: [number, number] = [e.lngLat.lat, e.lngLat.lng];
      marker.setLngLat(e.lngLat);
      setMapPickerCoords(coords);
      await fetchNearestStationForCoords(coords);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [isMapModalOpen]);

  // Handle dynamic map style updates when theme toggles
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setStyle(theme === 'dark' ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/bright');
    }
  }, [theme]);

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

  // Ranked checkpoint search: exact > startsWith > includes
  const rankCheckpoints = (list: any[], query: string) => {
    const q = query.toLowerCase().trim();
    if (!q) return list;
    const scored = list.map(cp => {
      const name = cp.name.toLowerCase();
      const nameAr = cp.nameAr.toLowerCase();
      const city = (cp.city || '').toLowerCase();
      let score = Infinity;
      if (name === q || nameAr === q) score = 0;
      else if (name.startsWith(q) || nameAr.startsWith(q)) score = 1;
      else if (city === q) score = 2;
      else if (city.startsWith(q)) score = 3;
      else if (name.includes(q) || nameAr.includes(q)) score = 4;
      else if (city.includes(q)) score = 5;
      return { cp, score };
    }).filter(item => item.score !== Infinity);
    scored.sort((a, b) => a.score - b.score);
    return scored.map(item => item.cp);
  };

  const filteredFromSuggestions = useMemo(() => {
    return rankCheckpoints(allCheckpoints, fromQuery);
  }, [fromQuery, allCheckpoints]);

  const filteredToSuggestions = useMemo(() => {
    const sourceList = fromStation ? reachableDropoffStations : allCheckpoints;
    return rankCheckpoints(sourceList, toQuery);
  }, [toQuery, fromStation, reachableDropoffStations, allCheckpoints]);

  // Combined suggestions: ranked checkpoints + Nominatim address results
  const combinedFromSuggestions = useMemo(() => {
    const items: Array<{ type: 'checkpoint' | 'address'; data: any; label: string; sublabel: string }> = [];
    if (fromQuery.trim()) {
      items.push(...filteredFromSuggestions.map(cp => ({
        type: 'checkpoint' as const,
        data: cp,
        label: cp.name,
        sublabel: cp.city,
      })));
      if (nominatimFromResults.length > 0) {
        items.push(...nominatimFromResults.map((r: any) => ({
          type: 'address' as const,
          data: r,
          label: r.name || r.display_name.split(',')[0] || 'Location',
          sublabel: r.display_name,
        })));
      }
    } else {
      items.push(...filteredFromSuggestions.map(cp => ({
        type: 'checkpoint' as const,
        data: cp,
        label: cp.name,
        sublabel: cp.city,
      })));
    }
    return items;
  }, [filteredFromSuggestions, nominatimFromResults, fromQuery]);

  const combinedToSuggestions = useMemo(() => {
    const items: Array<{ type: 'checkpoint' | 'address'; data: any; label: string; sublabel: string }> = [];
    if (toQuery.trim()) {
      items.push(...filteredToSuggestions.map(cp => ({
        type: 'checkpoint' as const,
        data: cp,
        label: cp.name,
        sublabel: cp.city,
      })));
      if (nominatimToResults.length > 0) {
        items.push(...nominatimToResults.map((r: any) => ({
          type: 'address' as const,
          data: r,
          label: r.name || r.display_name.split(',')[0] || 'Location',
          sublabel: r.display_name,
        })));
      }
    } else {
      items.push(...filteredToSuggestions.map(cp => ({
        type: 'checkpoint' as const,
        data: cp,
        label: cp.name,
        sublabel: cp.city,
      })));
    }
    return items;
  }, [filteredToSuggestions, nominatimToResults, toQuery]);

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
      setLocationNotice(t('gpsNotSupported'));
      setTimeout(() => setLocationNotice(null), 5000);
      return;
    }
    setLocationLoading(true);
    setLocationNotice(t('detectingLocation'));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        if (allCheckpoints.length === 0) {
          setLocationNotice(t('noStationsDefined'));
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
        setFromStation({
          ...nearestStation,
          lat: latitude,
          lng: longitude
        });
        setFromQuery(isRtl ? (nearestStation.nameAr || nearestStation.name) : nearestStation.name);

        const matchedMsg = t('matchedNearestStation', {
          name: isRtl ? (nearestStation.nameAr || nearestStation.name) : nearestStation.name,
          city: nearestStation.city,
          distance: minDistance.toFixed(2)
        });

        setLocationNotice(matchedMsg);
        setLocationLoading(false);
        setTimeout(() => setLocationNotice(null), 5000);
      },
      (error) => {
        setLocationNotice(t('failedToRetrieveLocation', { message: error.message }));
        setLocationLoading(false);
        setTimeout(() => setLocationNotice(null), 5000);
      }
    );
  };

  // Debounce fromQuery
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFromQuery(fromQuery), 300);
    return () => clearTimeout(timer);
  }, [fromQuery]);

  // Debounce toQuery
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedToQuery(toQuery), 300);
    return () => clearTimeout(timer);
  }, [toQuery]);

  // Nominatim search for From field
  useEffect(() => {
    const q = debouncedFromQuery.trim();
    if (!q || q.length < 2) {
      setNominatimFromResults([]);
      return;
    }
    let active = true;
    setNominatimLoading(true);
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=eg&limit=3`)
      .then(res => res.json())
      .then(data => {
        if (active) setNominatimFromResults(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (active) setNominatimFromResults([]); })
      .finally(() => { if (active) setNominatimLoading(false); });
    return () => { active = false; };
  }, [debouncedFromQuery]);

  // Nominatim search for To field
  useEffect(() => {
    const q = debouncedToQuery.trim();
    if (!q || q.length < 2) {
      setNominatimToResults([]);
      return;
    }
    let active = true;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=eg&limit=3`)
      .then(res => res.json())
      .then(data => {
        if (active) setNominatimToResults(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (active) setNominatimToResults([]); });
    return () => { active = false; };
  }, [debouncedToQuery]);

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

  // Handle selection from the combined dropdown (checkpoint or address)
  const handleSelectFromItem = async (item: { type: string; data: any }) => {
    if (item.type === 'checkpoint') {
      const cp = item.data;
      setFromStation(cp);
      setFromQuery(isRtl ? (cp.nameAr || cp.name) : cp.name);
      setFromFocused(false);
      if (!toStation) {
        setTimeout(() => setToFocused(true), 100);
      }
    } else if (item.type === 'address') {
      const r = item.data;
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.lon);
      try {
        setFromQuery(r.name || r.display_name.split(',')[0]);
        const results = await routesAPI.getNearestStation(lat, lng, 1);
        if (Array.isArray(results) && results.length > 0) {
          const nearest = results[0];
          const cp = nearest.checkpoint;
          const route = nearest.route;
          const parts = route.name.split(/\s+to\s+/i);
          const fromC = parts.length >= 1 ? parts[0].trim() : '';
          const city = cp.city || fromC.charAt(0).toUpperCase() + fromC.slice(1);
          setFromStation({
            name: cp.name,
            nameAr: cp.nameAr,
            lat: lat,
            lng: lng,
            city: city,
            routeId: route._id || route.id,
            order: cp.order,
          });
        }
      } catch (err) {
        console.error('Failed to find nearest station for address', err);
      }
      setFromFocused(false);
      if (!toStation) {
        setTimeout(() => setToFocused(true), 100);
      }
    }
  };

  const handleSelectToItem = async (item: { type: string; data: any }) => {
    if (item.type === 'checkpoint') {
      const cp = item.data;
      setToStation(cp);
      setToQuery(isRtl ? (cp.nameAr || cp.name) : cp.name);
      setToFocused(false);
    } else if (item.type === 'address') {
      const r = item.data;
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.lon);
      try {
        setToQuery(r.name || r.display_name.split(',')[0]);
        const results = await routesAPI.getNearestStation(lat, lng, 1);
        if (Array.isArray(results) && results.length > 0) {
          const nearest = results[0];
          const cp = nearest.checkpoint;
          const route = nearest.route;
          const parts = route.name.split(/\s+to\s+/i);
          const fromC = parts.length >= 1 ? parts[0].trim() : '';
          const city = cp.city || fromC.charAt(0).toUpperCase() + fromC.slice(1);
          setToStation({
            name: cp.name,
            nameAr: cp.nameAr,
            lat: lat,
            lng: lng,
            city: city,
            routeId: route._id || route.id,
            order: cp.order,
          });
        }
      } catch (err) {
        console.error('Failed to find nearest station for address', err);
      }
      setToFocused(false);
    }
  };

  // Keyboard navigation for From dropdown
  const handleFromKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!fromFocused) return;
    const items = Object.values(groupedFrom).flat();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFromActiveIndex(prev => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFromActiveIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items.length > 0 && fromActiveIndex >= 0 && fromActiveIndex < items.length) {
        handleSelectFromItem(items[fromActiveIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setFromFocused(false);
    }
  };

  // Keyboard navigation for To dropdown
  const handleToKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!toFocused) return;
    const items = Object.values(groupedTo).flat();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setToActiveIndex(prev => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setToActiveIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items.length > 0 && toActiveIndex >= 0 && toActiveIndex < items.length) {
        handleSelectToItem(items[toActiveIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setToFocused(false);
    }
  };

  // Reset active index when dropdown content changes
  useEffect(() => {
    setFromActiveIndex(0);
  }, [combinedFromSuggestions]);

  useEffect(() => {
    setToActiveIndex(0);
  }, [combinedToSuggestions]);

  const polylinePath: [number, number][] = [];
  if (fromStation) polylinePath.push([fromStation.lat, fromStation.lng]);
  if (toStation) polylinePath.push([toStation.lat, toStation.lng]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const groupedFrom = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const addressItems: any[] = [];
    combinedFromSuggestions.forEach(item => {
      if (item.type === 'address') {
        addressItems.push(item);
      } else {
        const city = item.data.city || 'Other';
        if (!groups[city]) groups[city] = [];
        groups[city].push(item);
      }
    });
    if (addressItems.length > 0) {
      groups['__addresses__'] = addressItems;
    }
    return groups;
  }, [combinedFromSuggestions]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const groupedTo = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const addressItems: any[] = [];
    combinedToSuggestions.forEach(item => {
      if (item.type === 'address') {
        addressItems.push(item);
      } else {
        const city = item.data.city || 'Other';
        if (!groups[city]) groups[city] = [];
        groups[city].push(item);
      }
    });
    if (addressItems.length > 0) {
      groups['__addresses__'] = addressItems;
    }
    return groups;
  }, [combinedToSuggestions]);

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
            {t('detectStation')}
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
            {t('selectOnMap')}
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
            <label className="field-label">{t('whereAreYouBoarding')}</label>
            <div className={`field-select-wrapper custom-select-container ${shakeFields ? 'shake-animation' : ''}`}>
              <MapPin size={16} className="field-icon-left" />
              <input
                type="text"
                className="field-input"
                placeholder={t('searchBoardingStopPlaceholder')}
                value={fromQuery}
                ref={fromInputRef}
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
                onKeyDown={handleFromKeyDown}
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
                  {Object.keys(groupedFrom).length === 0 && !nominatimLoading ? (
                    <div className="custom-dropdown-item" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
                      {t('noMatchingStations')}
                    </div>
                  ) : nominatimLoading && Object.keys(groupedFrom).length === 0 ? (
                    <div className="custom-dropdown-item" style={{ color: 'var(--text-muted)', cursor: 'default', justifyContent: 'center' }}>
                      <div className="btn-loading-spinner" style={{ width: 16, height: 16, marginRight: 8 }} />
                      Searching...
                    </div>
                  ) : (
                    Object.entries(groupedFrom).map(([city, items]) => (
                      <div key={city}>
                        {city === '__addresses__' ? (
                          <div style={{
                            padding: '6px 12px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            color: '#10B981',
                            background: 'rgba(16, 185, 129, 0.05)',
                            borderBottom: '1px solid var(--border)',
                            letterSpacing: '0.05em'
                          }}>
                            📍 Addresses & Places
                          </div>
                        ) : (
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
                        )}
                        {items.map((item: any) => {
                          const globalIdx = Object.values(groupedFrom).flat().indexOf(item);
                          if (item.type === 'address') {
                            const r = item.data;
                            return (
                              <div
                                key={`addr-${r.lat}-${r.lon}`}
                                className={`custom-dropdown-item ${globalIdx === fromActiveIndex ? 'keyboard-active' : ''}`}
                                onClick={() => handleSelectFromItem(item)}
                                onMouseEnter={() => setFromActiveIndex(globalIdx)}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                  <span style={{ fontWeight: 600, color: '#10B981' }}>
                                    {r.name || r.display_name.split(',')[0]}
                                  </span>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r.display_name}
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          const cp = item.data;
                          return (
                            <div
                              key={`${cp.name}-${cp.lat}-${cp.lng}-${cp.routeId}`}
                              className={`custom-dropdown-item ${globalIdx === fromActiveIndex ? 'keyboard-active' : ''} ${fromStation?.name === cp.name ? 'selected' : ''}`}
                              onClick={() => handleSelectFromItem(item)}
                              onMouseEnter={() => setFromActiveIndex(globalIdx)}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 600 }}>{isRtl ? cp.nameAr : cp.name}</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{cp.city}</span>
                              </div>
                            </div>
                          );
                        })}
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
            <label className="field-label">{t('whereAreYouGoing')}</label>
            <div className={`field-select-wrapper custom-select-container ${shakeFields ? 'shake-animation' : ''}`}>
              <MapPin size={16} className="field-icon-left" style={{ color: '#EF4444' }} />
              <input
                type="text"
                className="field-input"
                placeholder={
                  !fromStation
                    ? t('selectBoardingStopFirst')
                    : t('searchDestinationStopPlaceholder')
                }
                value={toQuery}
                ref={toInputRef}
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
                onKeyDown={handleToKeyDown}
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
                      {t('selectBoardingStopFirst')}
                    </div>
                  )}
                  {fromStation && Object.keys(groupedTo).length === 0 && !nominatimLoading ? (
                    <div className="custom-dropdown-item" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
                      {t('noReachableStopsFound')}
                    </div>
                  ) : fromStation && nominatimLoading && Object.keys(groupedTo).length === 0 ? (
                    <div className="custom-dropdown-item" style={{ color: 'var(--text-muted)', cursor: 'default', justifyContent: 'center' }}>
                      <div className="btn-loading-spinner" style={{ width: 16, height: 16, marginRight: 8 }} />
                      Searching...
                    </div>
                  ) : (
                    fromStation && Object.entries(groupedTo).map(([city, items]) => (
                      <div key={city}>
                        {city === '__addresses__' ? (
                          <div style={{
                            padding: '6px 12px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            color: '#10B981',
                            background: 'rgba(16, 185, 129, 0.05)',
                            borderBottom: '1px solid var(--border)',
                            letterSpacing: '0.05em'
                          }}>
                            📍 Addresses & Places
                          </div>
                        ) : (
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
                        )}
                        {items.map((item: any) => {
                          const globalIdx = Object.values(groupedTo).flat().indexOf(item);
                          if (item.type === 'address') {
                            const r = item.data;
                            return (
                              <div
                                key={`addr-${r.lat}-${r.lon}`}
                                className={`custom-dropdown-item ${globalIdx === toActiveIndex ? 'keyboard-active' : ''}`}
                                onClick={() => handleSelectToItem(item)}
                                onMouseEnter={() => setToActiveIndex(globalIdx)}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                  <span style={{ fontWeight: 600, color: '#10B981' }}>
                                    {r.name || r.display_name.split(',')[0]}
                                  </span>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r.display_name}
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          const cp = item.data;
                          return (
                            <div
                              key={`${cp.name}-${cp.lat}-${cp.lng}-${cp.routeId}`}
                              className={`custom-dropdown-item ${globalIdx === toActiveIndex ? 'keyboard-active' : ''} ${toStation?.name === cp.name ? 'selected' : ''}`}
                              onClick={() => handleSelectToItem(item)}
                              onMouseEnter={() => setToActiveIndex(globalIdx)}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 600 }}>{isRtl ? cp.nameAr : cp.name}</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{cp.city}</span>
                              </div>
                            </div>
                          );
                        })}
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
            <label className="field-label">{t('travelDateLabel')}</label>
            <CustomDatePicker
              value={travelDate}
              min={todayLocalStr}
              onChange={setTravelDate}
            />
          </div>
        </div>

        {/* ROW 4: PASSENGERS */}
        <div className="from-to-row">
          <div className="from-to-field full-width">
            <label className="field-label">{t('numberOfSeatsLabel')}</label>
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
                {t(passengers === 1 ? 'seatCountSingular' : 'seatCountPlural', { count: passengers })}
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
                  onClick={() => setPassengers((p) => Math.min(maxAvailableSeats, p + 1))}
                  className="passenger-control-btn"
                  disabled={passengers >= maxAvailableSeats}
                >
                  +
                </button>
              </div>
            </div>
            {fromStation && toStation && (
              <div style={{ fontSize: '0.75rem', color: maxAvailableSeats < 10 ? '#EF4444' : '#10B981', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                {isFetchingLimit ? (
                  <span>Checking seat availability...</span>
                ) : (
                  <span>
                    {maxAvailableSeats < 10 
                      ? `⚠️ Only ${maxAvailableSeats} seats left on this date!` 
                      : `✅ Up to ${maxAvailableSeats} seats available`}
                  </span>
                )}
              </div>
            )}
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
        {t('showTripsBtn')} <Search size={18} />
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
          {t('browseRoutesManually')}
        </Link>
      </div>

      {isMapModalOpen && mapPickerCoords && (
        <div className="map-picker-overlay" onClick={() => setIsMapModalOpen(false)}>
          <div className="map-picker-content" onClick={(e) => e.stopPropagation()}>
            <div className="map-picker-header">
              <h3 className="map-picker-title">
                {t('selectPickupLocationOnMap')}
              </h3>
              <button className="map-picker-close" onClick={() => setIsMapModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="map-picker-container">
              <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
            </div>

            {nearestStationFromMap ? (
              <div className="map-picker-info">
                <span className="map-picker-info-label">
                  {t('nearestMatchedStationMap')}
                </span>
                <span className="map-picker-info-value">
                  {isRtl 
                    ? (nearestStationFromMap.checkpoint.nameAr || nearestStationFromMap.checkpoint.name)
                    : nearestStationFromMap.checkpoint.name
                  } 
                  <span style={{ opacity: 0.6, fontSize: '0.8em', marginLeft: '6px' }}>
                    ({nearestStationFromMap.distanceMeters} {t('metersAway')})
                  </span>
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {t('route')}: {nearestStationFromMap.route.name}
                </span>
              </div>
            ) : (
              <div className="map-picker-info" style={{ borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }}>
                <span className="map-picker-info-value" style={{ color: '#ef4444' }}>
                  {t('noStationsFoundNearbyMap')}
                </span>
              </div>
            )}

            <div className="map-picker-actions">
              <button 
                className="map-picker-btn-cancel" 
                onClick={() => setIsMapModalOpen(false)}
              >
                {t('cancelBtn')}
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
                {t('confirmPickupStationBtn')}
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
  const { t, language } = useTranslation();

  const seoTitle = language === 'ar'
    ? 'دي-رايد | حجز أتوبيسات السفر في مصر'
    : 'D-Ride | Smart Mass-Transit & Bus Booking in Egypt';
  const seoDescription = language === 'ar'
    ? 'احجز مقعدك في حافلات دي-رايد المكيفة والمريحة للسفر بين القاهرة، الإسكندرية، شرم الشيخ، دهب، نويبع، وطابا مع تتبع مباشر عبر GPS.'
    : 'Book clean, air-conditioned buses connecting Cairo, Alexandria, Sharm El Sheikh, Dahab, Nuweiba, and Taba with real-time GPS tracking and cashless payments.';

  return (
    <>
      <SEO title={seoTitle} description={seoDescription} keywords="cairo, alexandria, sharm el sheikh, dahab, nuweiba, taba, القاهرة, الاسكندرية, شرم الشيخ, دهب, نويبع, طابا" />
      
      {/* ── Hero Section ─────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex items-center pt-28 pb-20 overflow-hidden" id="hero">
        <div className="max-w-7xl mx-auto px-container-margin w-full grid md:grid-cols-12 gap-12 md:gap-16 items-center relative z-10">
          
          {/* Left: Brand message & details */}
          <div className="md:col-span-7 flex flex-col items-start gap-6 md:gap-8 text-left">
            <div className="reveal-scale">
              <div className="flex items-center gap-2 px-4 py-2 glass-card rounded-full border border-white/10 select-none">
                <span className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
                <span className="font-label-sm text-label-sm text-white">{t('liveRouteTelemetryBadge')}</span>
              </div>
            </div>
            
            <h1 className="font-display-lg text-display-lg text-white leading-[1.05] reveal-scale">
              <span className="staggered-word" style={{ animationDelay: '0.4s' }}>
                {t('heroTitlePart1')}
              </span>
              <br />
              <span className="text-primary italic staggered-word" style={{ animationDelay: '0.6s' }}>
                {t('heroTitlePart2')} {t('heroTitleAccent')}
              </span>
            </h1>
            
            <p className="font-body-lg text-body-lg text-text-secondary max-w-xl leading-relaxed staggered-word" style={{ animationDelay: '0.8s' }}>
              {t('heroSubtitle')}
            </p>
            
            <div className="flex flex-wrap gap-4 mt-2 staggered-word" style={{ animationDelay: '0.9s' }}>
              <div className="flex items-center gap-3 glass-card px-5 py-3 rounded-xl border border-white/10">
                <Zap size={16} className="text-primary" />
                <span className="font-label-lg text-label-lg">{t('liveRouteTelemetryBadge')}</span>
              </div>
              <div className="flex items-center gap-3 glass-card px-5 py-3 rounded-xl border border-white/10">
                <Ticket size={16} className="text-primary" />
                <span className="font-label-lg text-label-lg">{t('simpleAndFast')}</span>
              </div>
            </div>
            
            <div className="flex gap-4 mt-4 staggered-word" style={{ animationDelay: '1.0s' }}>
              {isAuthenticated ? (
                <Link to="/my-trips" className="search-btn primary-glow min-w-[160px] !py-3 !rounded-full">
                  <Ticket size={18} /> {t('myTrips')}
                </Link>
              ) : (
                <Link to="/register" className="search-btn primary-glow min-w-[160px] !py-3 !rounded-full">
                  <Bus size={18} /> {t('bookARideBtn')}
                </Link>
              )}
              <a href="#how-it-works" className="px-6 py-3 border border-white/10 text-white rounded-full hover:bg-white/5 hover:border-white/20 transition-all font-semibold flex items-center justify-center">
                {t('learnMoreBtn')}
              </a>
            </div>
          </div>

          {/* Right: Autocomplete Booking Form */}
          <div className="md:col-span-5 reveal-slide-right w-full" style={{ animationDelay: '0.3s' }}>
            <div className="glass-card p-6 md:p-8 rounded-3xl flex flex-col gap-6 w-full border border-white/10 relative overflow-hidden animate-float">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl -mr-16 -mt-16 pointer-events-none" />
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <h2 className="font-headline-md text-headline-md text-white uppercase tracking-wider">{t('findYourRouteCardTitle')}</h2>
                <span className="font-label-sm text-label-sm text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">{t('selectYourDestinationCardSub')}</span>
              </div>
              <RouteSearchForm />
            </div>
          </div>

        </div>
      </section>

      {/* ── Stats Bar ────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-container-margin py-12 grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
        <div className="glass-card p-6 rounded-2xl text-center border border-white/5 flex flex-col gap-2 hover:scale-[1.03] transition-all duration-300">
          <div className="font-headline-lg text-headline-lg text-primary">{t('dailyRoutesVal')}</div>
          <div className="font-label-lg text-label-lg text-text-secondary">{t('dailyRoutesLbl')}</div>
        </div>
        <div className="glass-card p-6 rounded-2xl text-center border border-white/5 flex flex-col gap-2 hover:scale-[1.03] transition-all duration-300">
          <div className="font-headline-lg text-headline-lg text-primary">{t('happyRidersVal')}</div>
          <div className="font-label-lg text-label-lg text-text-secondary">{t('happyRidersLbl')}</div>
        </div>
        <div className="glass-card p-6 rounded-2xl text-center border border-white/5 flex flex-col gap-2 hover:scale-[1.03] transition-all duration-300">
          <div className="font-headline-lg text-headline-lg text-primary">{t('vehiclesVal')}</div>
          <div className="font-label-lg text-label-lg text-text-secondary">{t('vehiclesLbl')}</div>
        </div>
        <div className="glass-card p-6 rounded-2xl text-center border border-white/5 flex flex-col gap-2 hover:scale-[1.03] transition-all duration-300">
          <div className="font-headline-lg text-headline-lg text-primary">{t('avgRatingVal')}</div>
          <div className="font-label-lg text-label-lg text-text-secondary">{t('avgRatingLbl')}</div>
        </div>
      </div>

      {/* ── How It Works ─────────────────────────────────── */}
      <section className="py-24 bg-[#080808]/40 relative overflow-hidden border-y border-white/5" id="how-it-works">
        <div className="max-w-7xl mx-auto px-container-margin relative z-10">
          <div className="text-center mb-16 space-y-4">
            <span className="text-primary font-label-lg text-label-lg tracking-[0.4em] uppercase font-bold">{t('simpleAndFast')}</span>
            <h2 className="font-display-lg text-display-lg text-white">{t('howItWorksTitle')}</h2>
            <p className="text-text-secondary font-body-lg text-body-lg max-w-2xl mx-auto leading-relaxed">{t('howItWorksDesc')}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="feature-card glass-card p-10 rounded-[2rem] border border-white/5 group relative hover:scale-[1.02] transition-all duration-300">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-500">
                <Search size={32} className="text-primary" />
              </div>
              <h3 className="font-headline-md text-headline-md text-white mb-4 tracking-tight">{t('step1Title')}</h3>
              <p className="text-text-secondary font-body-md text-body-md leading-relaxed opacity-80">{t('step1Desc')}</p>
            </div>
            
            {/* Feature 2 */}
            <div className="feature-card glass-card p-10 rounded-[2rem] border border-white/5 group relative hover:scale-[1.02] transition-all duration-300">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-500">
                <Ticket size={32} className="text-primary" />
              </div>
              <h3 className="font-headline-md text-headline-md text-white mb-4 tracking-tight">{t('step2Title')}</h3>
              <p className="text-text-secondary font-body-md text-body-md leading-relaxed opacity-80">{t('step2Desc')}</p>
            </div>
            
            {/* Feature 3 */}
            <div className="feature-card glass-card p-10 rounded-[2rem] border border-white/5 group relative hover:scale-[1.02] transition-all duration-300">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-500">
                <Bus size={32} className="text-primary" />
              </div>
              <h3 className="font-headline-md text-headline-md text-white mb-4 tracking-tight">{t('step3Title')}</h3>
              <p className="text-text-secondary font-body-md text-body-md leading-relaxed opacity-80">{t('step3Desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────── */}
      <section className="py-24" id="features">
        <div className="max-w-7xl mx-auto px-container-margin relative z-10">
          <div className="text-center mb-16 space-y-4">
            <span className="text-primary font-label-lg text-label-lg tracking-[0.4em] uppercase font-bold">{t('whyDride')}</span>
            <h2 className="font-display-lg text-display-lg text-white">{t('builtForCairoStreets')}</h2>
            <p className="text-text-secondary font-body-lg text-body-lg max-w-2xl mx-auto leading-relaxed">{t('builtForCairoStreetsDesc')}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="glass-card p-8 rounded-2xl border border-white/5 flex gap-6 hover:scale-[1.01] transition-all">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <MapPin size={24} className="text-primary" />
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-white mb-2">{t('featureGpsTitle')}</h3>
                <p className="text-text-secondary font-body-md text-body-md leading-relaxed">{t('featureGpsDesc')}</p>
              </div>
            </div>

            <div className="glass-card p-8 rounded-2xl border border-white/5 flex gap-6 hover:scale-[1.01] transition-all">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <CreditCard size={24} className="text-primary" />
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-white mb-2">{t('featurePaymentTitle')}</h3>
                <p className="text-text-secondary font-body-md text-body-md leading-relaxed">{t('featurePaymentDesc')}</p>
              </div>
            </div>

            <div className="glass-card p-8 rounded-2xl border border-white/5 flex gap-6 hover:scale-[1.01] transition-all">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <Snowflake size={24} className="text-primary" />
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-white mb-2">{t('featureComfortTitle')}</h3>
                <p className="text-text-secondary font-body-md text-body-md leading-relaxed">{t('featureComfortDesc')}</p>
              </div>
            </div>

            <div className="glass-card p-8 rounded-2xl border border-white/5 flex gap-6 hover:scale-[1.01] transition-all">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <Zap size={24} className="text-primary" />
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-white mb-2">{t('featurePricingTitle')}</h3>
                <p className="text-text-secondary font-body-md text-body-md leading-relaxed">{t('featurePricingDesc')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="w-full bg-[#080808]/80 border-t border-white/5 py-12 relative z-10">
        <div className="max-w-7xl mx-auto px-container-margin flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
          <div className="flex flex-col items-center md:items-start gap-3">
            <div className="flex items-center gap-2">
              <img src={logo} alt="D-Ride" className="h-8 w-auto rounded-md object-contain" />
              <span className="font-headline-md text-headline-md font-extrabold text-[#F5B731] tracking-tighter cursor-pointer select-none">D-<span className="text-white">RIDE</span></span>
            </div>
            <p className="text-text-muted text-xs">{t('operatedBy')}</p>
          </div>
          
          <ul className="flex flex-wrap gap-6 text-sm font-medium justify-center">
            <li><Link to="/about" className="text-text-secondary hover:text-primary transition">{t('about')}</Link></li>
            <li><Link to="/terms" className="text-text-secondary hover:text-primary transition">{t('terms')}</Link></li>
            <li><Link to="/privacy" className="text-text-secondary hover:text-primary transition">{t('privacy')}</Link></li>
            <li><Link to="/contact" className="text-text-secondary hover:text-primary transition">{t('contact')}</Link></li>
          </ul>

          <span className="text-text-muted text-xs">© {new Date().getFullYear()} D-Ride. {t('allRightsReserved')}</span>
        </div>
      </footer>
    </>
  );
}
