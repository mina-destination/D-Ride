import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Table, Button, Modal, Input, Space, message, Steps, Spin, Select } from 'antd';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { routesAPI } from '../services/api';
import { 
  Map, 
  MapPin, 
  ArrowLeft, 
  ArrowRight, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Navigation,
  Activity,
  CheckCircle2,
  Clock,
  Radio,
  Download,
  Compass
} from 'lucide-react';
import { exportToCSV } from '../utils/csv';

// Fix for default marker icon in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Circular Markers styled like D-Ride
const createGreenIcon = (text: string) => new L.DivIcon({
  html: `<div style="background-color: #10B981; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2.5px solid white; box-shadow: 0 3px 8px rgba(16,185,129,0.4); font-size: 11px;">${text}</div>`,
  className: 'custom-div-icon-green',
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

const createRedIcon = (text: string) => new L.DivIcon({
  html: `<div style="background-color: #EF4444; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2.5px solid white; box-shadow: 0 3px 8px rgba(239,68,68,0.4); font-size: 11px;">${text}</div>`,
  className: 'custom-div-icon-red',
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

const createCheckpointIcon = (num: number) => new L.DivIcon({
  html: `<div style="background-color: #3B82F6; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2.5px solid white; box-shadow: 0 3px 8px rgba(59,130,246,0.4); font-size: 12px;">${num}</div>`,
  className: 'custom-div-icon-blue',
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

// Autopan hook to fit coordinates bounds
function MapAutoCenter({ checkpoints }: { checkpoints: any[] }) {
  const map = useMap();
  useEffect(() => {
    if (checkpoints.length > 0) {
      const coords = checkpoints.map(c => [c.location.coordinates[1], c.location.coordinates[0]] as [number, number]);
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [checkpoints, map]);
  return null;
}

// Map Click Handler aware of Wizard Step
function MapClickHandler({ 
  onMapClick 
}: { 
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Utility to convert Google Drive share links to direct download URLs
function cleanGoogleDriveLink(url: string): string {
  if (!url) return '';
  
  let fileId = '';
  
  if (url.includes('drive.google.com')) {
    // Format 1: /file/d/FILE_ID/view...
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      fileId = match[1];
    } else {
      // Format 2: open?id=FILE_ID or open.id=...
      const queryMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (queryMatch && queryMatch[1]) {
        fileId = queryMatch[1];
      }
    }
  } else if (url.includes('lh3.googleusercontent.com')) {
    // Format 3: lh3.googleusercontent.com/d/FILE_ID
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      fileId = match[1];
    }
  } else if (url.includes('docs.google.com')) {
    // Format 4: docs.google.com/file/d/FILE_ID/...
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

const POPULAR_TERMINALS = [
  { name: '✈️ Cairo Airport', lng: 31.4056, lat: 30.1219 },
  { name: '🚉 Ramses Station', lng: 31.2464, lat: 30.0631 },
  { name: '📍 Heliopolis', lng: 31.3283, lat: 30.0911 },
  { name: '🏡 New Cairo (AUC)', lng: 31.5034, lat: 30.0169 },
  { name: '🏢 Smart Village', lng: 30.7811, lat: 30.0769 },
  { name: '🌳 Maadi', lng: 31.2755, lat: 29.9602 }
];

// Reusable nominatim location autocomplete input with coordinates & keyboard support
function SearchAutocomplete({
  placeholder,
  value,
  onChange,
  onSelect
}: {
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  onSelect: (name: string, lng: number, lat: number) => void;
}) {
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [debouncedValue, setDebouncedValue] = useState(value || '');
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef<boolean>(false);

  // Debounce the input value
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [value]);

  // Handle results fetching from Nominatim with debounced value
  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    if (!debouncedValue || debouncedValue.length < 3) {
      setResults([]);
      setActiveIndex(0);
      return;
    }

    let active = true;
    const fetchResults = async () => {
      setLoading(true);
      try {
        // Detect coordinates: match latitude and longitude separated by comma/space/semicolon
        const match = debouncedValue.match(/^\s*(-?\d+(?:\.\d+)?)\s*[\s,;]\s*(-?\d+(?:\.\d+)?)\s*$/);
        if (match) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            // Raw coordinates option
            const rawOption = {
              display_name: `Coordinates: Lat ${lat.toFixed(6)}, Lng ${lng.toFixed(6)}`,
              name: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
              lon: lng.toString(),
              lat: lat.toString(),
              is_coords: true,
              is_raw: true
            };
            
            if (active) {
              setResults([rawOption]);
              setOpen(true);
              setActiveIndex(0);
            }
            
            // Try to reverse geocode using OSM reverse geocoding
            try {
              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
              const data = await res.json();
              if (active) {
                if (data && data.display_name) {
                  const resolvedOption = {
                    display_name: data.display_name,
                    name: data.name || data.display_name.split(',')[0] || `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
                    lon: lng.toString(),
                    lat: lat.toString(),
                    is_coords: true,
                    is_resolved: true
                  };
                  setResults([resolvedOption, rawOption]);
                  setActiveIndex(0);
                }
              }
            } catch (err) {
              console.error('Reverse geocoding failed', err);
            }
            return;
          }
        }

        // Standard address search
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(debouncedValue)}&countrycodes=eg&limit=5`);
        const data = await res.json();
        if (active) {
          setResults(data);
          setOpen(true);
          setActiveIndex(0);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchResults();

    return () => {
      active = false;
    };
  }, [debouncedValue]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectOption = (item: any) => {
    justSelectedRef.current = true;
    const displayName = item.display_name;
    const shortName = item.name || displayName.split(',')[0];
    onSelect(shortName, parseFloat(item.lon), parseFloat(item.lat));
    setOpen(false);
    setResults([]);
    setActiveIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        selectOption(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', zIndex: open ? 10005 : 9999 }}>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={e => {
          justSelectedRef.current = false;
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        suffix={loading ? <Spin size="small" /> : '🔍'}
      />
      {open && (results.length > 0 || !value || value.length < 3 || loading) && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          zIndex: 10000,
          maxHeight: '260px',
          overflowY: 'auto',
          marginTop: '6px',
          padding: '4px 0'
        }}>
          {results.length > 0 ? (
            results.map((r, idx) => {
              const displayName = r.display_name;
              const shortName = r.name || displayName.split(',')[0];
              const isHighlighted = idx === activeIndex;
              return (
                <div
                  key={idx}
                  onClick={() => selectOption(r)}
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    borderBottom: idx < results.length - 1 ? '1px solid var(--border)' : 'none',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: isHighlighted ? 'var(--surface-hover)' : 'transparent',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: r.is_coords 
                      ? 'rgba(245, 183, 49, 0.15)' 
                      : 'rgba(16, 185, 129, 0.15)',
                    color: r.is_coords ? '#F5B731' : '#10B981',
                    flexShrink: 0
                  }}>
                    {r.is_coords ? <Compass size={14} /> : <MapPin size={14} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                    <strong style={{ 
                      color: isHighlighted ? 'var(--primary-color)' : 'var(--text-primary)',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap'
                    }}>
                      {shortName}
                    </strong>
                    <span style={{ 
                      fontSize: '10px', 
                      color: 'var(--text-muted)', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap' 
                    }}>
                      {displayName}
                    </span>
                  </div>
                </div>
              );
            })
          ) : loading ? (
            <div style={{ padding: '12px 14px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
              <Spin size="small" style={{ marginRight: '8px' }} /> Searching Egypt map...
            </div>
          ) : value && value.length >= 3 ? (
            <div style={{ padding: '12px 14px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
              😞 No locations found in Egypt.
              <div style={{ marginTop: '4px', fontSize: '10px', opacity: 0.8 }}>
                Tip: Try double-clicking on the map to place a terminal manually!
              </div>
            </div>
          ) : (
            <div style={{ padding: '8px 14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Quick-Select Hubs (Cairo)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {POPULAR_TERMINALS.map((pt, pIdx) => (
                  <div
                    key={pIdx}
                    onClick={() => {
                      onSelect(pt.name, pt.lng, pt.lat);
                      setOpen(false);
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                    }}
                  >
                    <MapPin size={12} style={{ color: 'var(--primary-color)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ fontWeight: 600 }}>{pt.name}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {pt.lat.toFixed(3)}, {pt.lng.toFixed(3)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {value && value.length >= 1 && value.length < 3 && (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic', textAlign: 'center' }}>
                  Type at least 3 characters to search Osm Nominatim...
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Custom controller to pan/fly to selected coordinates
function MapPanController({ panTo }: { panTo: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (panTo) {
      map.flyTo(panTo, 15, { animate: true, duration: 1.5 });
    }
  }, [panTo, map]);
  return null;
}

// Helper: reverse geocode to extract city name from coordinates
async function reverseGeocodeCity(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`);
    const data = await res.json();
    if (data?.address) {
      return data.address.city || data.address.town || data.address.state || data.address.county || '';
    }
  } catch { /* ignore */ }
  return '';
}

// Helper: compute straight-line distance in meters between two [lng,lat] coordinate pairs
function haversineDistance(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function RoutesPage() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [distanceFilter, setDistanceFilter] = useState<string>('ALL');
  
  const location = useLocation();
  useEffect(() => {
    if (location.state && (location.state as any).searchTerm) {
      setSearchTerm((location.state as any).searchTerm);
    }
  }, [location.state]);

  // Wizard state machine
  const [currentStep, setCurrentStep] = useState(0);
  const [routeName, setRouteName] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [points, setPoints] = useState<[number, number][]>([]); // Snapped route polyline coordinates
  const [snapping, setSnapping] = useState(false);

  // Auto-complete queries
  const [startQuery, setStartQuery] = useState('');
  const [endQuery, setEndQuery] = useState('');
  const [cpQuery, setCpQuery] = useState('');
  const [mapPanTo, setMapPanTo] = useState<[number, number] | null>(null);
  const [activeHoverIndex, setActiveHoverIndex] = useState<number | null>(null);

  // Quick Fill pricing state
  const [quickFillTotal, setQuickFillTotal] = useState<number>(0);

  const fetchRoutes = async () => {
    try {
      setLoading(true);
      const res = await routesAPI.getAll();
      setRoutes(res);
    } catch (error) {
      message.error('Failed to fetch routes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  const handleOpenModal = (route?: any) => {
    setCurrentStep(0);
    setStartQuery('');
    setEndQuery('');
    setCpQuery('');
    setMapPanTo(null);
    
    if (route) {
      setEditingId(route._id);
      setRouteName(route.name);
      setCoverImage(route.coverImage || '');
      setDistanceKm(route.distanceKm || 0);
      setDurationMinutes(route.estimatedDurationMinutes || 0);
      setCheckpoints(route.checkpoints || []);
      
      if (route.path && route.path.coordinates) {
        setPoints(route.path.coordinates.map((coord: number[]) => [coord[1], coord[0]]));
      } else {
        setPoints([]);
      }
    } else {
      setEditingId(null);
      setRouteName('');
      setCoverImage('');
      setDistanceKm(0);
      setDurationMinutes(0);
      setPoints([]);
      setCheckpoints([]);
    }
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    setMapPanTo(null);
  };

  const handleReverseRoute = async (route: any) => {
    let reversedName = `${route.name} (Reversed)`;
    if (route.name.toLowerCase().includes(' to ')) {
      const parts = route.name.split(/\s+[tT][oO]\s+/i);
      if (parts.length === 2) {
        reversedName = `${parts[1]} to ${parts[0]}`;
      }
    } else if (route.name.includes(' ➔ ')) {
      const parts = route.name.split(' ➔ ');
      if (parts.length === 2) {
        reversedName = `${parts[1]} ➔ ${parts[0]}`;
      }
    } else if (route.name.includes(' -> ')) {
      const parts = route.name.split(' -> ');
      if (parts.length === 2) {
        reversedName = `${parts[1]} -> ${parts[0]}`;
      }
    }

    const reversedCps = [...(route.checkpoints || [])].reverse();
    const syncedCps = reversedCps.map((cp, idx) => {
      let type: 'START' | 'CHECKPOINT' | 'END' = 'CHECKPOINT';
      let bufferTimeMinutes = cp.bufferTimeMinutes;
      if (idx === 0) {
        type = 'START';
        bufferTimeMinutes = cp.bufferTimeMinutes > 0 ? cp.bufferTimeMinutes : 5;
      } else if (idx === reversedCps.length - 1 && reversedCps.length > 1) {
        type = 'END';
        bufferTimeMinutes = 0;
      }
      return {
        ...cp,
        order: idx + 1,
        type,
        bufferTimeMinutes
      };
    });

    setEditingId(null);
    setRouteName(reversedName);
    setCoverImage(route.coverImage || '');
    setCheckpoints(syncedCps);
    
    await generateSnappedRoute(syncedCps);
    
    setCurrentStep(0);
    setStartQuery('');
    setEndQuery('');
    setCpQuery('');
    
    if (syncedCps[0]?.location.coordinates) {
      setMapPanTo([syncedCps[0].location.coordinates[1], syncedCps[0].location.coordinates[0]]);
    }
    
    setIsModalOpen(true);
    message.success('Generated return route! You can review details and save.');
  };

  // Re-calculate ordering index and stop type
  const syncCheckpointsList = (list: any[]) => {
    return list.map((item, idx) => {
      let type: 'START' | 'CHECKPOINT' | 'END' = 'CHECKPOINT';
      if (idx === 0) type = 'START';
      else if (idx === list.length - 1 && list.length > 1) type = 'END';
      return {
        ...item,
        order: idx + 1,
        type
      };
    });
  };

  const addStartTerminal = (name: string, lng: number, lat: number) => {
    const newStart = {
      name,
      location: { type: 'Point', coordinates: [lng, lat] },
      order: 1,
      type: 'START' as const,
      bufferTimeMinutes: 5,
      geofenceRadiusMeters: 100,
      minutesFromStart: 0,
      city: '',
      priceFromStartEGP: 0
    };
    setCheckpoints(prev => {
      const updated = [...prev];
      const startIdx = updated.findIndex(c => c.type === 'START');
      if (startIdx !== -1) {
        updated[startIdx] = newStart;
      } else {
        updated.unshift(newStart);
      }
      return syncCheckpointsList(updated);
    });
    setStartQuery(name);
    setMapPanTo([lat, lng]);
    // Auto-fill city from reverse geocoding
    reverseGeocodeCity(lat, lng).then(city => {
      if (city) {
        setCheckpoints(prev => {
          const updated = [...prev];
          const si = updated.findIndex(c => c.type === 'START');
          if (si !== -1 && !updated[si].city) updated[si] = { ...updated[si], city };
          return updated;
        });
      }
    });
  };

  const addEndTerminal = (name: string, lng: number, lat: number) => {
    const newEnd = {
      name,
      location: { type: 'Point', coordinates: [lng, lat] },
      order: checkpoints.length + 1,
      type: 'END' as const,
      bufferTimeMinutes: 0,
      geofenceRadiusMeters: 100,
      minutesFromStart: 0,
      city: '',
      priceFromStartEGP: 0
    };
    setCheckpoints(prev => {
      const updated = [...prev];
      const endIdx = updated.findIndex(c => c.type === 'END');
      if (endIdx !== -1) {
        updated[endIdx] = newEnd;
      } else {
        updated.push(newEnd);
      }
      return syncCheckpointsList(updated);
    });
    setEndQuery(name);
    setMapPanTo([lat, lng]);
    // Auto-fill city from reverse geocoding
    reverseGeocodeCity(lat, lng).then(city => {
      if (city) {
        setCheckpoints(prev => {
          const updated = [...prev];
          const ei = updated.findIndex(c => c.type === 'END');
          if (ei !== -1 && !updated[ei].city) updated[ei] = { ...updated[ei], city };
          return updated;
        });
      }
    });
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (currentStep === 1) {
      // Place start first, then end
      const hasStart = checkpoints.some(c => c.type === 'START');
      if (!hasStart) {
        addStartTerminal(`Terminal Start (${lat.toFixed(4)}, ${lng.toFixed(4)})`, lng, lat);
        message.success('Start terminal placed! Now select or click to place End terminal.');
      } else {
        addEndTerminal(`Terminal End (${lat.toFixed(4)}, ${lng.toFixed(4)})`, lng, lat);
        message.success('End terminal placed! Click Next to configure intermediate checkpoints.');
      }
    } else if (currentStep === 2) {
      // Add checkpoint intermediate
      const newCp = {
        name: `Checkpoint ${checkpoints.length}`,
        location: { type: 'Point', coordinates: [lng, lat] },
        order: checkpoints.length + 1,
        type: 'CHECKPOINT' as const,
        bufferTimeMinutes: 2,
        geofenceRadiusMeters: 50,
        minutesFromStart: 0,
        city: '',
        priceFromStartEGP: 0
      };
      setCheckpoints(prev => {
        const updated = [...prev];
        const endIdx = updated.findIndex(c => c.type === 'END');
        if (endIdx !== -1) {
          updated.splice(endIdx, 0, newCp);
        } else {
          updated.push(newCp);
        }
        return syncCheckpointsList(updated);
      });
      setMapPanTo([lat, lng]);
      message.success('Checkpoint added!');
    }
  };

  const handleMarkerDragEnd = (idx: number, lat: number, lng: number) => {
    const updated = [...checkpoints];
    updated[idx] = {
      ...updated[idx],
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      }
    };
    const synced = syncCheckpointsList(updated);
    setCheckpoints(synced);
    if (currentStep >= 3) {
      generateSnappedRoute(synced);
    }
  };

  const moveCheckpoint = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === checkpoints.length - 1) return;
    
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    const updated = [...checkpoints];
    const temp = updated[idx];
    updated[idx] = updated[newIdx];
    updated[newIdx] = temp;
    
    setCheckpoints(syncCheckpointsList(updated));
  };

  const deleteCheckpoint = (idx: number) => {
    const updated = checkpoints.filter((_, i) => i !== idx);
    setCheckpoints(syncCheckpointsList(updated));
    message.warning('Stop removed');
  };

  // OSRM snapped roadway router
  const generateSnappedRoute = async (stops: any[]) => {
    if (stops.length < 2) return;
    setSnapping(true);
    
    const coordsString = stops
      .map(s => `${s.location.coordinates[0]},${s.location.coordinates[1]}`)
      .join(';');
      
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;
    
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const snappedCoords = route.geometry.coordinates; // number[][]
        const latLngs = snappedCoords.map((c: number[]) => [c[1], c[0]] as [number, number]);
        
        setPoints(latLngs);
        setDistanceKm(parseFloat((route.distance / 1000).toFixed(2)));
        setDurationMinutes(Math.ceil(route.duration / 60));
      }
    } catch (error) {
      console.warn('OSRM Route snapping failed, using straight-line fallback:', error);
      // Fallback straight lines
      const latLngs = stops.map(s => [s.location.coordinates[1], s.location.coordinates[0]] as [number, number]);
      setPoints(latLngs);
      setDistanceKm(15);
      setDurationMinutes(25);
    } finally {
      setSnapping(false);
    }
  };

  const handleNextStep = async () => {
    if (currentStep === 0) {
      if (!routeName.trim()) {
        message.error('Please enter a route name');
        return;
      }
      setCurrentStep(1);
    } else if (currentStep === 1) {
      const hasStart = checkpoints.some(c => c.type === 'START');
      const hasEnd = checkpoints.some(c => c.type === 'END');
      if (!hasStart || !hasEnd) {
        message.error('Please configure both Start and End terminals.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (checkpoints.length < 2) {
        message.error('Plot at least Start and End points.');
        return;
      }
      // Merged step: trigger snap and move directly to review
      await generateSnappedRoute(checkpoints);
      setCurrentStep(3);
    }
  };

  const handleSaveRoute = async () => {
    try {
      if (points.length < 2) {
        message.error('Please build a valid snapped path before saving.');
        return;
      }
      const geoJsonCoordinates = points.map(p => [p[1], p[0]]);
      
      const payload = {
        name: routeName,
        coverImage: coverImage,
        path: {
          type: 'LineString',
          coordinates: geoJsonCoordinates,
        },
        checkpoints: checkpoints,
        distanceKm: distanceKm,
        estimatedDurationMinutes: durationMinutes
      };

      if (editingId) {
        await routesAPI.update(editingId, payload);
        message.success('Route updated successfully! 🚀');
      } else {
        await routesAPI.create(payload);
        message.success('Route created successfully! 🚀');
      }
      setIsModalOpen(false);
      fetchRoutes();
    } catch (error) {
      message.error((error as any).message || 'Operation failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await routesAPI.delete(id);
      message.success('Route deleted successfully');
      fetchRoutes();
    } catch (error) {
      message.error('Failed to delete route');
    }
  };

  const filteredRoutes = routes.filter(r => {
    const matchesSearch = r.name?.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesDistance = true;
    if (distanceFilter !== 'ALL' && r.distanceKm != null) {
      const km = r.distanceKm;
      if (distanceFilter === 'SHORT') matchesDistance = km <= 20;
      else if (distanceFilter === 'MEDIUM') matchesDistance = km > 20 && km <= 50;
      else if (distanceFilter === 'LONG') matchesDistance = km > 50;
    }

    return matchesSearch && matchesDistance;
  });

  const columns = [
    {
      title: 'Landscape Banner',
      dataIndex: 'coverImage',
      key: 'coverImage',
      render: (imgUrl: string, r: any) => (
        <div style={{
          width: '120px',
          height: '64px',
          borderRadius: '8px',
          backgroundImage: imgUrl ? `url("${imgUrl}")` : 'linear-gradient(135deg, var(--primary-color, #f5b731) 0%, #1a202c 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '14px',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)'
        }}>
          {!imgUrl && (r.name ? r.name.substring(0, 2).toUpperCase() : 'DR')}
        </div>
      )
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <strong style={{ color: 'var(--text-primary)' }}>{text}</strong>
    },
    {
      title: 'Distance',
      dataIndex: 'distanceKm',
      key: 'distanceKm',
      render: (val: number) => <span style={{ fontWeight: 600 }}>{val ? `${val} km` : '—'}</span>
    },
    {
      title: 'Duration',
      dataIndex: 'estimatedDurationMinutes',
      key: 'estimatedDurationMinutes',
      render: (val: number) => <span style={{ color: 'var(--text-secondary)' }}>{val ? `${val} mins` : '—'}</span>
    },
    {
      title: 'Checkpoints count',
      dataIndex: 'checkpoints',
      key: 'checkpoints',
      render: (list: any[]) => <span>{list ? list.length : 0} stops</span>
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" onClick={() => handleOpenModal(record)}>Edit Wizard</Button>
          <Button type="link" style={{ color: '#10B981' }} onClick={() => handleReverseRoute(record)}>Reverse Route</Button>
          <Button type="link" danger onClick={() => handleDelete(record._id)}>Delete</Button>
        </Space>
      ),
    },
  ];

  const handleExport = () => {
    const headers = [
      { key: '_id', label: 'Route ID', transform: (val: string) => val.toUpperCase() },
      { key: 'name', label: 'Route Name' },
      { key: 'distanceKm', label: 'Distance (Km)' },
      { key: 'estimatedDurationMinutes', label: 'Estimated Duration (mins)' },
      { key: 'checkpoints', label: 'Checkpoints Count', transform: (val: any[]) => val ? val.length : 0 },
    ];
    exportToCSV(filteredRoutes, headers, 'routes_report');
  };

  return (
    <div style={{ padding: '2rem 0' }}>
      <div className="dashboard-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Map size={28} /> Routes Management</h1>
          <p>Manage all transit routes across the network using a D-Ride Wizard</p>
        </div>
        <Space>
          <Input.Search
            placeholder="Search routes..."
            value={searchTerm}
            onSearch={value => setSearchTerm(value)}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            value={distanceFilter}
            onChange={value => setDistanceFilter(value)}
            style={{ width: 180 }}
          >
            <Select.Option value="ALL">All Distances</Select.Option>
            <Select.Option value="SHORT">Short (≤20 km)</Select.Option>
            <Select.Option value="MEDIUM">Medium (20–50 km)</Select.Option>
            <Select.Option value="LONG">Long (50+ km)</Select.Option>
          </Select>
          <Button 
            onClick={handleExport} 
            icon={<Download size={16} />}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '40px' }}
          >
            Export CSV
          </Button>
          <Button type="primary" size="large" onClick={() => handleOpenModal()} style={{ background: 'var(--primary-color)', border: 'none', color: '#000', fontWeight: 'bold' }}>
            + Create D-Ride Route
          </Button>
        </Space>
      </div>
      
      <Table 
        dataSource={filteredRoutes} 
        columns={columns} 
        rowKey="_id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
        style={{ marginTop: '2rem' }}
      />

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', fontWeight: 800 }}>
            <Navigation size={22} style={{ color: 'var(--primary-color)' }} />
            {editingId ? "Edit Transit Route Wizard" : "Create D-Ride Transit Route Wizard"}
          </div>
        }
        open={isModalOpen}
        onCancel={handleCancel}
        footer={null}
        width={1000}
        destroyOnHidden
      >
        <div style={{ margin: '1.5rem 0' }}>
          <Steps 
            current={currentStep} 
            size="small" 
            items={[
              { title: 'Setup' },
              { title: 'Terminals' },
              { title: 'Stops & Checkpoints' },
              { title: 'Review & Snap' }
            ]} 
          />
        </div>

        <div className="wizard-content" style={{ minHeight: '400px', display: 'grid', gridTemplateColumns: currentStep > 0 ? '420px 1fr' : '1fr', gap: '20px' }}>
          
          {/* LEFT PANEL: CONFIGURATION CONTROLS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            {/* STEP 0: ROUTE SETUP */}
            {currentStep === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '6px' }}>Route Name</label>
                  <Input 
                    placeholder="e.g. Cairo Smart Village to Heliopolis" 
                    value={routeName} 
                    onChange={e => setRouteName(e.target.value)} 
                    size="large"
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '6px' }}>Route Banner Image URL / Google Drive link (Optional)</label>
                  <Input 
                    placeholder="https://drive.google.com/file/d/... or regular image URL" 
                    value={coverImage} 
                    onChange={e => {
                      const cleanUrl = cleanGoogleDriveLink(e.target.value);
                      setCoverImage(cleanUrl);
                    }} 
                    size="large"
                  />
                  {coverImage && (
                    <div style={{ marginTop: '15px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Banner Preview:</span>
                      <div style={{
                        marginTop: '8px',
                        width: '100%',
                        height: '140px',
                        borderRadius: '8px',
                        backgroundImage: `url("${coverImage}")`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        border: '1px solid var(--border)',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                      }} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 1: TERMINALS CONFIGURATION */}
            {currentStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ padding: '12px', background: 'rgba(245, 183, 49, 0.08)', border: '1px solid rgba(245, 183, 49, 0.2)', borderRadius: '8px' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-dark)', margin: 0, fontSize: '13px' }}>
                    <MapPin size={16} /> Place Start and End Terminals
                  </h4>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Search locations using Nominatim or double-click directly on the map to set terminal coordinates.
                  </p>
                </div>

                <div>
                  <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px', color: '#10B981' }}>🟢 Start Trip Terminal</label>
                  <SearchAutocomplete 
                    placeholder="Search start location..."
                    value={startQuery}
                    onChange={setStartQuery}
                    onSelect={(name, lng, lat) => addStartTerminal(name, lng, lat)}
                  />
                  {checkpoints.some(c => c.type === 'START') && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Selected: <strong>{checkpoints.find(c => c.type === 'START')?.name}</strong>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px', color: '#EF4444' }}>🏁 End Destination Terminal</label>
                  <SearchAutocomplete 
                    placeholder="Search destination location..."
                    value={endQuery}
                    onChange={setEndQuery}
                    onSelect={(name, lng, lat) => addEndTerminal(name, lng, lat)}
                  />
                  {checkpoints.some(c => c.type === 'END') && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Selected: <strong>{checkpoints.find(c => c.type === 'END')?.name}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: STOPS & CHECKPOINTS CUSTOMIZATION */}
            {currentStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ padding: '12px', background: 'var(--surface-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <h4 style={{ margin: 0, fontSize: '13px' }}>Stops & Checkpoints Customization</h4>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Plot checkpoints on the map, then configure city, pricing, and timing for each stop. Cities & times are auto-filled from geocoding.
                  </p>
                </div>

                <div>
                  <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>Add Stop</label>
                  <SearchAutocomplete 
                    placeholder="Search & add a checkpoint..."
                    value={cpQuery}
                    onChange={setCpQuery}
                    onSelect={(name, lng, lat) => {
                      // Auto-calculate minutesFromStart based on distance interpolation
                      let autoMinutes = 0;
                      const existingCps = [...checkpoints];
                      const endIdx = existingCps.findIndex(c => c.type === 'END');
                      const insertIdx = endIdx !== -1 ? endIdx : existingCps.length;
                      if (insertIdx > 0) {
                        const prevCp = existingCps[insertIdx - 1];
                        const prevCoords = prevCp.location.coordinates;
                        const distToPrev = haversineDistance(prevCoords[0], prevCoords[1], lng, lat);
                        // Estimate ~2 minutes per km
                        const estimatedMins = Math.round((distToPrev / 1000) * 2);
                        autoMinutes = (prevCp.minutesFromStart || 0) + Math.max(1, estimatedMins);
                      }

                      const newCp = {
                        name,
                        location: { type: 'Point', coordinates: [lng, lat] },
                        order: checkpoints.length + 1,
                        type: 'CHECKPOINT' as const,
                        bufferTimeMinutes: 2,
                        geofenceRadiusMeters: 50,
                        city: '',
                        priceFromStartEGP: 0,
                        minutesFromStart: autoMinutes
                      };
                      setCheckpoints(prev => {
                        const updated = [...prev];
                        const eIdx = updated.findIndex(c => c.type === 'END');
                        if (eIdx !== -1) updated.splice(eIdx, 0, newCp);
                        else updated.push(newCp);
                        return syncCheckpointsList(updated);
                      });
                      setCpQuery('');
                      message.success('Checkpoint added!');
                      // Auto-fill city
                      reverseGeocodeCity(lat, lng).then(city => {
                        if (city) {
                          setCheckpoints(prev => {
                            const updated = [...prev];
                            const cpIdx = updated.findIndex(c => c.name === name && !c.city);
                            if (cpIdx !== -1) updated[cpIdx] = { ...updated[cpIdx], city };
                            return updated;
                          });
                        }
                      });
                    }}
                  />
                </div>

                {/* QUICK FILL PRICING ASSISTANT */}
                <div style={{ 
                  padding: '10px 12px', 
                  background: 'rgba(245, 183, 49, 0.06)', 
                  border: '1px dashed rgba(245, 183, 49, 0.3)', 
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary-color)', whiteSpace: 'nowrap' }}>⚡ Quick Fill Pricing:</span>
                  <Input
                    type="number"
                    placeholder="Total route fare (EGP)"
                    value={quickFillTotal || ''}
                    onChange={e => setQuickFillTotal(parseFloat(e.target.value) || 0)}
                    size="small"
                    style={{ width: '140px' }}
                    min={0}
                  />
                  <Button
                    size="small"
                    type="primary"
                    disabled={!quickFillTotal || checkpoints.length < 2}
                    onClick={() => {
                      const totalTime = checkpoints[checkpoints.length - 1]?.minutesFromStart || 1;
                      setCheckpoints(prev => {
                        return prev.map(cp => {
                          const ratio = (cp.minutesFromStart || 0) / totalTime;
                          return { ...cp, priceFromStartEGP: Math.round(quickFillTotal * ratio) };
                        });
                      });
                      message.success(`Prices auto-distributed across ${checkpoints.length} stops!`);
                    }}
                    style={{ background: 'var(--primary-color)', border: 'none', color: '#000', fontWeight: 700, fontSize: '11px' }}
                  >
                    Auto-Fill Prices
                  </Button>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    Distributes proportionally based on each stop's time from start
                  </span>
                </div>

                <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
                  {checkpoints.map((cp, idx) => {
                    const isStart = cp.type === 'START';
                    const isEnd = cp.type === 'END';
                    return (
                      <div 
                        key={idx} 
                        onMouseEnter={() => setActiveHoverIndex(idx)}
                        onMouseLeave={() => setActiveHoverIndex(null)}
                        style={{ 
                          padding: '12px', 
                          background: isStart ? 'rgba(16, 185, 129, 0.04)' : isEnd ? 'rgba(239, 68, 68, 0.04)' : 'var(--surface-elevated)',
                          borderRadius: '8px', 
                          border: isStart ? '1px solid rgba(16, 185, 129, 0.2)' : isEnd ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid var(--border)', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '8px',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              background: isStart ? '#10B981' : isEnd ? '#EF4444' : '#3B82F6',
                              color: '#fff',
                              fontSize: '11px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              flexShrink: 0
                            }}>
                              {isStart ? 'S' : isEnd ? 'E' : idx}
                            </span>
                            <span style={{ color: isStart ? '#10B981' : isEnd ? '#EF4444' : 'var(--text-primary)' }}>
                              {isStart ? 'Start Terminal' : isEnd ? 'End Destination' : `Stop #${idx}`}
                            </span>
                            {cp.city && (
                              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--primary-color)', background: 'rgba(245,183,49,0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                                {cp.city}
                              </span>
                            )}
                          </span>

                          <Space size="small">
                            <Button 
                              size="small" 
                              icon={<ArrowUp size={12} />} 
                              disabled={idx === 0} 
                              onClick={() => moveCheckpoint(idx, 'up')}
                            />
                            <Button 
                              size="small" 
                              icon={<ArrowDown size={12} />} 
                              disabled={idx === checkpoints.length - 1} 
                              onClick={() => moveCheckpoint(idx, 'down')}
                            />
                            {!isStart && !isEnd && (
                              <Button 
                                type="text" 
                                danger 
                                size="small"
                                icon={<Trash2 size={14} />} 
                                onClick={() => deleteCheckpoint(idx)} 
                              />
                            )}
                          </Space>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {/* Row 1: Names */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            <Input 
                              value={cp.name}
                              onChange={e => {
                                const updated = [...checkpoints];
                                updated[idx].name = e.target.value;
                                setCheckpoints(updated);
                              }}
                              placeholder="Stop Name (English)"
                              size="small"
                            />
                            <Input 
                              value={cp.nameAr || ''}
                              onChange={e => {
                                const updated = [...checkpoints];
                                updated[idx].nameAr = e.target.value;
                                setCheckpoints(updated);
                              }}
                              placeholder="اسم المحطة (Arabic)"
                              size="small"
                              style={{ textAlign: 'right', direction: 'rtl' }}
                            />
                          </div>

                          {/* Row 2: CITY + PRICE (promoted first-class fields) */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            <div>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: '#F5B731', display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}>
                                🏙️ City Leg
                              </span>
                              <Input 
                                placeholder="e.g. Cairo, Alexandria"
                                value={cp.city || ''}
                                onChange={e => {
                                  const updated = [...checkpoints];
                                  updated[idx].city = e.target.value;
                                  setCheckpoints(updated);
                                }}
                                size="small"
                                style={{ borderColor: cp.city ? '#10B981' : undefined }}
                              />
                            </div>
                            <div>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: '#10B981', display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}>
                                💵 Cumulative Fare (EGP)
                              </span>
                              <Input 
                                type="number"
                                value={cp.priceFromStartEGP ?? 0}
                                onChange={e => {
                                  const updated = [...checkpoints];
                                  updated[idx].priceFromStartEGP = parseFloat(e.target.value) || 0;
                                  setCheckpoints(updated);
                                }}
                                size="small"
                                min={0}
                                style={{ borderColor: (cp.priceFromStartEGP > 0) ? '#10B981' : undefined }}
                              />
                            </div>
                          </div>

                          {/* Row 3: Timing + Geofence (secondary config) */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                            <div>
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '2px' }}>
                                <Clock size={9} /> From Start (min)
                              </span>
                              <Input 
                                type="number"
                                value={isStart ? 0 : (cp.minutesFromStart ?? 0)}
                                onChange={e => {
                                  const updated = [...checkpoints];
                                  updated[idx].minutesFromStart = parseInt(e.target.value, 10) || 0;
                                  setCheckpoints(updated);
                                }}
                                size="small"
                                min={0}
                                disabled={isStart}
                              />
                            </div>
                            <div>
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '2px' }}>
                                <Clock size={9} /> Buffer (min)
                              </span>
                              <Input 
                                type="number"
                                value={cp.bufferTimeMinutes}
                                onChange={e => {
                                  const updated = [...checkpoints];
                                  updated[idx].bufferTimeMinutes = parseInt(e.target.value, 10) || 0;
                                  setCheckpoints(updated);
                                }}
                                size="small"
                                min={0}
                              />
                            </div>
                            <div>
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '2px' }}>
                                <Radio size={9} /> Geofence (m)
                              </span>
                              <Input 
                                type="number"
                                value={cp.geofenceRadiusMeters}
                                onChange={e => {
                                  const updated = [...checkpoints];
                                  updated[idx].geofenceRadiusMeters = parseInt(e.target.value, 10) || 0;
                                  setCheckpoints(updated);
                                }}
                                size="small"
                                min={10}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* FARE LADDER SUMMARY */}
                {checkpoints.length >= 2 && (
                  <div style={{ 
                    padding: '12px', 
                    background: 'rgba(16, 185, 129, 0.04)', 
                    border: '1px solid rgba(16, 185, 129, 0.15)', 
                    borderRadius: '8px' 
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: '#10B981' }}>
                      📊 Fare Ladder Summary
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {checkpoints.map((cp, idx) => {
                        const prevCp = idx > 0 ? checkpoints[idx - 1] : null;
                        const segmentPrice = prevCp ? ((cp.priceFromStartEGP || 0) - (prevCp.priceFromStartEGP || 0)) : 0;
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                            <span style={{ 
                              width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                              background: cp.type === 'START' ? '#10B981' : cp.type === 'END' ? '#EF4444' : '#3B82F6',
                              color: '#fff', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                            }}>
                              {cp.type === 'START' ? 'S' : cp.type === 'END' ? 'E' : idx}
                            </span>
                            <span style={{ flex: 1, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {cp.name} {cp.city ? `(${cp.city})` : ''}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              +{cp.minutesFromStart || 0}m
                            </span>
                            <span style={{ fontWeight: 800, color: '#10B981', whiteSpace: 'nowrap', minWidth: '55px', textAlign: 'right' }}>
                              {cp.priceFromStartEGP || 0} EGP
                            </span>
                            {prevCp && segmentPrice > 0 && (
                              <span style={{ fontSize: '9px', color: 'var(--primary-color)', background: 'rgba(245,183,49,0.1)', padding: '1px 5px', borderRadius: '3px', whiteSpace: 'nowrap' }}>
                                +{segmentPrice} leg
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: OSRM SNAPPING & REVIEW */}
            {currentStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ padding: '12px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', textAlign: 'center' }}>
                  <CheckCircle2 size={32} style={{ color: '#10B981', margin: '0 auto 8px' }} />
                  <h4 style={{ margin: 0, fontSize: '14px' }}>OSRM Road Snapping Done!</h4>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    The path has been successfully snapped to the actual Cairo transit road network.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ padding: '12px', background: 'var(--surface-elevated)', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Snapped Distance</span>
                    <h3 style={{ margin: '4px 0 0', fontSize: '1.25rem', fontWeight: 800 }}>{distanceKm} km</h3>
                  </div>
                  <div style={{ padding: '12px', background: 'var(--surface-elevated)', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Est. Duration</span>
                    <h3 style={{ margin: '4px 0 0', fontSize: '1.25rem', fontWeight: 800 }}>{durationMinutes} mins</h3>
                  </div>
                </div>

                <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
                  <strong style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>Route Summary:</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
                    <div>🟢 <strong>Start:</strong> {checkpoints[0]?.name}</div>
                    {checkpoints.slice(1, -1).map((cp, i) => (
                      <div key={i}>📍 <strong>Stop {i+1}:</strong> {cp.name} ({cp.bufferTimeMinutes} mins wait)</div>
                    ))}
                    <div>🏁 <strong>End:</strong> {checkpoints[checkpoints.length - 1]?.name}</div>
                  </div>
                </div>
              </div>
            )}

            {/* BUTTON NAVIGATION BAR */}
            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid var(--border)' }}>
              {currentStep > 0 && (
                <Button 
                  icon={<ArrowLeft size={16} />} 
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  style={{ flex: 1 }}
                >
                  Back
                </Button>
              )}
              {currentStep < 3 ? (
                <Button 
                  type="primary" 
                  icon={<ArrowRight size={16} />} 
                  onClick={handleNextStep}
                  style={{ flex: 1, background: 'var(--primary-color)', border: 'none', color: '#000', fontWeight: 'bold' }}
                >
                  Next
                </Button>
              ) : (
                <Button 
                  type="primary" 
                  icon={<Activity size={16} />} 
                  onClick={handleSaveRoute}
                  style={{ flex: 1, background: '#10B981', border: 'none', color: '#fff', fontWeight: 'bold' }}
                >
                  Save Route
                </Button>
              )}
            </div>

          </div>

          {/* RIGHT PANEL: INTERACTIVE LEAFLET MAP */}
          {currentStep > 0 && (
            <div style={{ height: '480px', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
              {snapping && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.5)',
                  zIndex: 2000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '1rem',
                  fontWeight: 600,
                  gap: '8px'
                }}>
                  <Spin size="large" /> Snapping path to roadways...
                </div>
              )}
              <MapContainer 
                center={checkpoints[0]?.location.coordinates ? [checkpoints[0].location.coordinates[1], checkpoints[0].location.coordinates[0]] : [30.0444, 31.2357]} 
                zoom={12} 
                style={{ height: '100%', width: '100%', zIndex: 1 }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                <MapClickHandler onMapClick={handleMapClick} />
                <MapAutoCenter checkpoints={checkpoints} />
                <MapPanController panTo={mapPanTo} />

                {/* Snapped polyline path */}
                {points.length > 0 && (
                  <Polyline positions={points} color="var(--primary-color)" weight={6} opacity={0.8} />
                )}

                {/* Custom circular markers with drag support */}
                {checkpoints.map((cp, idx) => {
                  const latLng: [number, number] = [cp.location.coordinates[1], cp.location.coordinates[0]];
                  const isStart = cp.type === 'START';
                  const isEnd = cp.type === 'END';
                  
                  const isHovered = activeHoverIndex === idx;
                  let customIcon;
                  if (isHovered) {
                    const baseColor = isStart ? '#10B981' : isEnd ? '#EF4444' : '#3B82F6';
                    const textLabel = isStart ? 'S' : isEnd ? 'E' : `${idx}`;
                    customIcon = new L.DivIcon({
                      html: `<div style="background-color: ${baseColor}; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid #F5B731; box-shadow: 0 0 15px #F5B731, 0 3px 8px rgba(0,0,0,0.3); font-size: 13px; transition: all 0.2s; animation: map-pulse 1.2s infinite alternate;">${textLabel}</div>`,
                      className: 'custom-div-icon-highlighted',
                      iconSize: [34, 34],
                      iconAnchor: [17, 17]
                    });
                  } else {
                    if (isStart) customIcon = createGreenIcon('S');
                    else if (isEnd) customIcon = createRedIcon('E');
                    else customIcon = createCheckpointIcon(idx);
                  }

                  return (
                    <Marker
                      key={`wizard-cp-${idx}`}
                      position={latLng}
                      icon={customIcon}
                      draggable={true}
                      eventHandlers={{
                        dragend: (e) => {
                          const marker = e.target;
                          const pos = marker.getLatLng();
                          handleMarkerDragEnd(idx, pos.lat, pos.lng);
                        }
                      }}
                    >
                      <Popup>
                        <div style={{ fontFamily: 'Inter, sans-serif' }}>
                          <strong style={{ display: 'block', fontSize: '13px' }}>{cp.name}</strong>
                          {cp.nameAr && <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>{cp.nameAr}</span>}
                          <hr style={{ margin: '6px 0', border: 'none', borderBottom: '1px solid #eee' }} />
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                            Order: #{cp.order} ({cp.type})<br />
                            Wait: {cp.bufferTimeMinutes} mins<br />
                            Geofence: {cp.geofenceRadiusMeters}m
                          </span>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          )}

        </div>
      </Modal>
      <style>{`
        @keyframes map-pulse {
          0% { transform: scale(1.0); }
          100% { transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
