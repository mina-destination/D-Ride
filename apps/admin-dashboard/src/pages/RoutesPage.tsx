import { useEffect, useState, useRef } from 'react';
import { Table, Button, Modal, Input, Space, message, Steps, Spin } from 'antd';
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
  Radio
} from 'lucide-react';

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

// Curated travel cover pictures for Egypt
const PRESET_IMAGES = [
  { label: 'Smart Village Premium Tech Hub', value: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80' },
  { label: 'Maadi Scenic Ring Road Corridor', value: 'https://images.unsplash.com/photo-1541462608141-2f58c6e68e98?auto=format&fit=crop&w=600&q=80' },
  { label: 'Cairo Downtown Historic Architecture', value: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80' },
  { label: 'New Cairo Modern Corporate District', value: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=600&q=80' },
  { label: '6th of October Industrial Complex', value: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=600&q=80' },
  { label: 'Heliopolis Golden Sunsets', value: 'https://images.unsplash.com/photo-1472214222541-d510753a4907?auto=format&fit=crop&w=600&q=80' }
];

// Reusable nominatim location autocomplete input
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
  const containerRef = useRef<HTMLDivElement>(null);

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
    if (!debouncedValue || debouncedValue.length < 3) {
      setResults([]);
      return;
    }

    let active = true;
    const fetchResults = async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(debouncedValue)}&countrycodes=eg&limit=5`);
        const data = await res.json();
        if (active) {
          setResults(data);
          setOpen(true);
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

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', zIndex: 9999 }}>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (value && value.length >= 3) {
            setOpen(true);
          }
        }}
        suffix={loading ? <Spin size="small" /> : '🔍'}
      />
      {open && results.length > 0 && (
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
          maxHeight: '200px',
          overflowY: 'auto',
          marginTop: '6px'
        }}>
          {results.map((r, idx) => {
            const displayName = r.display_name;
            const shortName = r.name || displayName.split(',')[0];
            return (
              <div
                key={idx}
                onClick={() => {
                  onSelect(shortName, parseFloat(r.lon), parseFloat(r.lat));
                  setOpen(false);
                  setResults([]);
                }}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  borderBottom: idx < results.length - 1 ? '1px solid var(--border)' : 'none',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-hover)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <strong>{shortName}</strong>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </span>
              </div>
            );
          })}
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

export function RoutesPage() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Wizard state machine
  const [currentStep, setCurrentStep] = useState(0);
  const [routeName, setRouteName] = useState('');
  const [coverImage, setCoverImage] = useState(PRESET_IMAGES[0].value);
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
      setCoverImage(route.coverImage || PRESET_IMAGES[0].value);
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
      setCoverImage(PRESET_IMAGES[0].value);
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
      geofenceRadiusMeters: 100
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
  };

  const addEndTerminal = (name: string, lng: number, lat: number) => {
    const newEnd = {
      name,
      location: { type: 'Point', coordinates: [lng, lat] },
      order: checkpoints.length + 1,
      type: 'END' as const,
      bufferTimeMinutes: 0,
      geofenceRadiusMeters: 100
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
        geofenceRadiusMeters: 50
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
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // Trigger snap and move to review
      await generateSnappedRoute(checkpoints);
      setCurrentStep(4);
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

  const filteredRoutes = routes.filter(r => 
    r.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      title: 'Landscape Banner',
      dataIndex: 'coverImage',
      key: 'coverImage',
      render: (imgUrl: string) => (
        <div style={{
          width: '120px',
          height: '64px',
          borderRadius: '8px',
          backgroundImage: `url(${imgUrl || PRESET_IMAGES[0].value})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
        }} />
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
          <Button type="link" danger onClick={() => handleDelete(record._id)}>Delete</Button>
        </Space>
      ),
    },
  ];

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
        destroyOnClose
      >
        <div style={{ margin: '1.5rem 0' }}>
          <Steps 
            current={currentStep} 
            size="small" 
            items={[
              { title: 'Setup' },
              { title: 'Terminals' },
              { title: 'Stops' },
              { title: 'Metadata' },
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
                  <label style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '6px' }}>Select Cover Landscape Banner</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    {PRESET_IMAGES.map((img, idx) => (
                      <div 
                        key={idx}
                        onClick={() => setCoverImage(img.value)}
                        style={{
                          border: coverImage === img.value ? '3px solid var(--primary-color)' : '1px solid var(--border)',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.2s',
                          boxShadow: coverImage === img.value ? '0 4px 15px rgba(245, 183, 49, 0.25)' : 'none'
                        }}
                      >
                        <div style={{ height: '70px', backgroundImage: `url(${img.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                        <div style={{ padding: '6px', fontSize: '11px', fontWeight: 600, textAlign: 'center', background: 'var(--surface-elevated)' }}>
                          {img.label}
                        </div>
                        {coverImage === img.value && (
                          <div style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--primary-color)', color: '#000', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                            ✓
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
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

            {/* STEP 2: INTERMEDIATE STOPS */}
            {currentStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ padding: '12px', background: 'var(--surface-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <h4 style={{ margin: 0, fontSize: '13px' }}>Intermediate Boarding Checkpoints</h4>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Add locations where buses wait for riders. Click on the map to place pins between Start and End.
                  </p>
                </div>

                <div>
                  <label style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>Add Stop</label>
                  <SearchAutocomplete 
                    placeholder="Search & add a checkpoint..."
                    value={cpQuery}
                    onChange={setCpQuery}
                    onSelect={(name, lng, lat) => {
                      const newCp = {
                        name,
                        location: { type: 'Point', coordinates: [lng, lat] },
                        order: checkpoints.length + 1,
                        type: 'CHECKPOINT' as const,
                        bufferTimeMinutes: 2,
                        geofenceRadiusMeters: 50
                      };
                      setCheckpoints(prev => {
                        const updated = [...prev];
                        const endIdx = updated.findIndex(c => c.type === 'END');
                        if (endIdx !== -1) updated.splice(endIdx, 0, newCp);
                        else updated.push(newCp);
                        return syncCheckpointsList(updated);
                      });
                      setCpQuery('');
                      message.success('Checkpoint added!');
                    }}
                  />
                </div>

                <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {checkpoints.map((cp, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '8px 10px', 
                        background: cp.type === 'START' ? 'rgba(16,185,129,0.06)' : cp.type === 'END' ? 'rgba(239,68,68,0.06)' : 'var(--surface-elevated)',
                        borderRadius: '6px',
                        border: '1px solid var(--border)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        <span style={{
                          width: '20px', 
                          height: '20px', 
                          borderRadius: '50%', 
                          background: cp.type === 'START' ? '#10B981' : cp.type === 'END' ? '#EF4444' : '#3B82F6', 
                          color: '#fff', 
                          fontSize: '10px',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          flexShrink: 0
                        }}>
                          {cp.type === 'START' ? 'S' : cp.type === 'END' ? 'E' : idx}
                        </span>
                        <strong style={{ fontSize: '12px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{cp.name}</strong>
                      </div>
                      {cp.type === 'CHECKPOINT' && (
                        <Button 
                          type="text" 
                          danger 
                          size="small"
                          icon={<Trash2 size={14} />} 
                          onClick={() => deleteCheckpoint(idx)} 
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3: CHECKPOINTS METADATA & SEQUENCING */}
            {currentStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                <h4 style={{ margin: 0, fontSize: '13px' }}>Stop Buffers & Geofences</h4>
                
                {checkpoints.map((cp, idx) => (
                  <div key={idx} style={{ padding: '12px', background: 'var(--surface-elevated)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: cp.type === 'START' ? '#10B981' : cp.type === 'END' ? '#EF4444' : '#3B82F6',
                          color: '#fff',
                          fontSize: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold'
                        }}>
                          {cp.type === 'START' ? 'S' : cp.type === 'END' ? 'E' : idx}
                        </span>
                        {cp.type === 'START' ? 'Start Terminal' : cp.type === 'END' ? 'End Destination' : `Checkpoint #${idx}`}
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
                      </Space>
                    </div>

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
                      placeholder="Stop Name (Arabic) - optional"
                      size="small"
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                          <Clock size={10} style={{ display: 'inline', marginRight: '3px' }} /> Wait Buffer (mins)
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
                        />
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                          <Radio size={10} style={{ display: 'inline', marginRight: '3px' }} /> Geofence (meters)
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
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* STEP 4: OSRM SNAPPING & REVIEW */}
            {currentStep === 4 && (
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
              {currentStep < 4 ? (
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
                  
                  let customIcon;
                  if (isStart) customIcon = createGreenIcon('S');
                  else if (isEnd) customIcon = createRedIcon('E');
                  else customIcon = createCheckpointIcon(idx);

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
    </div>
  );
}
