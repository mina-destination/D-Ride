import { useEffect, useState, useRef } from 'react';
import { Card, Input, Badge, Button, Typography, Empty } from 'antd';
import { Search, Radio } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { io } from 'socket.io-client';
import { vehiclesAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const { Title, Text } = Typography;

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface LiveVehicle {
  id: string;
  _id: string;
  make: string;
  model: string;
  licensePlate: string;
  status: string;
  capacity: number;
  driver?: {
    name: string;
    phone: string;
  };
  location?: {
    lat: number;
    lng: number;
    speed: number;
    lastUpdated: string;
  };
}

export function LiveTrackingPage() {
  const { theme } = useTheme();
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Record<string, maplibregl.Marker>>({});
  const socketRef = useRef<any>(null);

  // Fetch initial fleet data
  const fetchFleet = async () => {
    try {
      const res = await vehiclesAPI.getAll();
      const mapped: LiveVehicle[] = (res || []).map((v: any) => {
        // Find last reported location from relation
        const locRecord = v.locations?.[0];
        const coordinates = locRecord?.location?.coordinates || locRecord?.location || null;
        
        let loc = undefined;
        if (coordinates && Array.isArray(coordinates) && coordinates.length >= 2) {
          loc = {
            lng: coordinates[0],
            lat: coordinates[1],
            speed: locRecord?.speedKmh || 0,
            lastUpdated: locRecord?.lastUpdatedAt || new Date().toISOString(),
          };
        }

        return {
          id: v._id || v.id,
          _id: v._id || v.id,
          make: v.make || 'D-Ride',
          model: v.model || 'Vehicle',
          licensePlate: v.licensePlate || v.plateNumber || 'N/A',
          status: v.status || (v.isActive ? 'ACTIVE' : 'OUT_OF_SERVICE'),
          capacity: v.capacity || 14,
          driver: v.driver ? {
            name: v.driver.name,
            phone: v.driver.phone,
          } : undefined,
          location: loc,
        };
      });
      setVehicles(mapped);
    } catch (err) {
      console.error('Failed to load fleet data for tracking', err);
    }
  };

  useEffect(() => {
    fetchFleet();
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const mapObj = new maplibregl.Map({
      container: mapContainerRef.current,
      style: theme === 'dark' ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/bright',
      center: [31.2357, 30.0444], // Cairo Default
      zoom: 11,
      attributionControl: false,
    });

    // Suppress missing sprite image warnings
    mapObj.on('styleimagemissing', (e) => {
      const width = 16;
      const height = 16;
      const data = new Uint8Array(width * height * 4);
      if (!mapObj.hasImage(e.id)) {
        mapObj.addImage(e.id, { width, height, data });
      }
    });

    mapObj.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    mapObj.on('load', () => {
      mapRef.current = mapObj;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [theme]);

  // Connect WebSockets
  useEffect(() => {
    const token = localStorage.getItem('dride_token');
    const socket = io(SOCKET_URL, {
      path: '/api/socket.io',
      transports: ['polling', 'websocket'],
      auth: { token },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Live Tracking Page connected to WebSocket');
      // Subscribe to all vehicle updates
      vehicles.forEach(v => {
        if (v.id) {
          socket.emit('subscribeToVehicle', v.id);
        }
      });
    });

    socket.on('vehicleLocationUpdate', (data: any) => {
      if (data && data.vehicleId && data.location) {
        const coords = data.location.coordinates || [data.location.longitude, data.location.latitude];
        if (!Array.isArray(coords) || coords.length < 2) return;

        setVehicles(prevVehicles =>
          prevVehicles.map(v => {
            if (v.id === data.vehicleId) {
              return {
                ...v,
                location: {
                  lng: coords[0],
                  lat: coords[1],
                  speed: data.speedKmh || 0,
                  lastUpdated: new Date().toISOString(),
                },
              };
            }
            return v;
          })
        );
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [vehicles.length]);

  // Synchronize Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers for vehicles no longer in list or offline
    const activeIds = new Set(vehicles.filter(v => v.location).map(v => v.id));
    Object.keys(markersRef.current).forEach(id => {
      if (!activeIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Add or update markers
    vehicles.forEach(v => {
      if (!v.location) return;

      const { lat, lng, speed, lastUpdated } = v.location;
      const isSelected = selectedVehicleId === v.id;

      let marker = markersRef.current[v.id];

      if (!marker) {
        // Create custom element
        const el = document.createElement('div');
        el.className = 'live-vehicle-marker';
        el.style.width = '36px';
        el.style.height = '36px';
        el.style.borderRadius = '50%';
        el.style.background = isSelected ? '#10b981' : 'var(--primary-color, #F5B731)';
        el.style.border = '3px solid #1e293b';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.color = isSelected ? 'white' : 'black';
        el.style.boxShadow = isSelected ? '0 0 15px rgba(16, 185, 129, 0.8)' : '0 0 10px rgba(245, 183, 49, 0.5)';
        el.style.cursor = 'pointer';
        el.innerHTML = '🚌';

        marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map);

        el.addEventListener('click', () => {
          setSelectedVehicleId(v.id);
          map.easeTo({ center: [lng, lat], zoom: 13 });
        });

        markersRef.current[v.id] = marker;
      } else {
        // Update position
        marker.setLngLat([lng, lat]);
        
        // Update element styles
        const el = marker.getElement();
        el.style.background = isSelected ? '#10b981' : 'var(--primary-color, #F5B731)';
        el.style.color = isSelected ? 'white' : 'black';
        el.style.boxShadow = isSelected ? '0 0 15px rgba(16, 185, 129, 0.8)' : '0 0 10px rgba(245, 183, 49, 0.5)';
      }

      // Sync Popup content
      const popupHtml = `
        <div style="min-width: 200px; padding: 4px; font-family: Inter, sans-serif; color: var(--text-primary);">
          <h4 style="margin: 0 0 6px 0; color: var(--primary-color, #F5B731); font-size: 0.95rem; font-weight: bold; display: flex; align-items: center; gap: 4px;">
            🚌 ${v.make} ${v.model}
          </h4>
          <span style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">Plate: <strong>${v.licensePlate}</strong></span>
          <hr style="margin: 6px 0; border: none; border-bottom: 1px solid var(--border);" />
          <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem;">
            <span><strong>Driver:</strong> ${v.driver?.name || 'No Driver Assigned'}</span>
            <span><strong>Speed:</strong> ${speed.toFixed(1)} km/h</span>
            <span><strong>Last Update:</strong> ${new Date(lastUpdated).toLocaleTimeString()}</span>
          </div>
        </div>
      `;

      let popup = marker.getPopup();
      if (!popup) {
        popup = new maplibregl.Popup({ offset: 15 }).setHTML(popupHtml);
        marker.setPopup(popup);
      } else {
        popup.setHTML(popupHtml);
      }
    });
  }, [vehicles, selectedVehicleId]);

  const handleCenterVehicle = (v: LiveVehicle) => {
    if (!v.location || !mapRef.current) return;
    setSelectedVehicleId(v.id);
    mapRef.current.easeTo({
      center: [v.location.lng, v.location.lat],
      zoom: 13,
      duration: 1000,
    });
  };

  // Filter list
  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = 
      v.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.driver?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const isOnline = !!v.location;
    const matchesStatus = 
      statusFilter === 'ALL' ||
      (statusFilter === 'ONLINE' && isOnline) ||
      (statusFilter === 'OFFLINE' && !isOnline);

    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', margin: '-1rem -2rem', overflow: 'hidden' }}>
      
      {/* Sidebar Panel */}
      <div style={{
        width: '380px',
        background: '#111318',
        borderRight: '1px solid #1f2430',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
        boxShadow: '4px 0 15px rgba(0,0,0,0.2)'
      }}>
        
        {/* Header */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #1f2430' }}>
          <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
            <Radio color="#10b981" size={24} style={{ animation: 'pulse 1.5s infinite' }} /> 
            Live Tracking
          </Title>
          <Text style={{ color: '#8f9cae', fontSize: '0.85rem' }}>Track vehicle movements and speed indicators live</Text>
        </div>

        {/* Filters */}
        <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '10px', borderBottom: '1px solid #1f2430' }}>
          <Input
            placeholder="Search make, model, license, driver..."
            prefix={<Search size={16} style={{ color: '#8f9cae' }} />}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ borderRadius: '8px', background: '#171a23', borderColor: '#2e374a', color: 'white' }}
          />

          <div style={{ display: 'flex', gap: '6px' }}>
            <Button
              type={statusFilter === 'ALL' ? 'primary' : 'default'}
              size="small"
              onClick={() => setStatusFilter('ALL')}
              style={{ borderRadius: '6px' }}
            >
              All ({vehicles.length})
            </Button>
            <Button
              type={statusFilter === 'ONLINE' ? 'primary' : 'default'}
              size="small"
              onClick={() => setStatusFilter('ONLINE')}
              style={{ borderRadius: '6px' }}
            >
              Online ({vehicles.filter(v => v.location).length})
            </Button>
            <Button
              type={statusFilter === 'OFFLINE' ? 'primary' : 'default'}
              size="small"
              onClick={() => setStatusFilter('OFFLINE')}
              style={{ borderRadius: '6px' }}
            >
              Offline ({vehicles.filter(v => !v.location).length})
            </Button>
          </div>
        </div>

        {/* Fleet List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {filteredVehicles.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No matching vehicles found" />
          ) : (
            filteredVehicles.map(v => {
              const isOnline = !!v.location;
              const isSelected = selectedVehicleId === v.id;

              return (
                <Card
                  key={v.id}
                  hoverable
                  onClick={() => handleCenterVehicle(v)}
                  style={{
                    marginBottom: '0.75rem',
                    background: isSelected ? '#1b2230' : '#161922',
                    borderColor: isSelected ? '#10b981' : '#232938',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  bodyStyle={{ padding: '12px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <Text style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'white', display: 'block' }}>
                        {v.make} {v.model}
                      </Text>
                      <Text style={{ fontSize: '0.8rem', color: '#8f9cae', display: 'block', marginTop: '2px' }}>
                        Plate: <strong>{v.licensePlate}</strong>
                      </Text>
                    </div>
                    <Badge 
                      status={isOnline ? 'success' : 'default'} 
                      text={isOnline ? 'Online' : 'Offline'} 
                      style={{ color: isOnline ? '#34d399' : '#8f9cae', fontSize: '0.75rem' }} 
                    />
                  </div>

                  <hr style={{ border: 'none', borderBottom: '1px solid #232938', margin: '8px 0' }} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: '#8f9cae' }}>
                    <span><strong>Driver:</strong> {v.driver?.name || 'No driver linked'}</span>
                    
                    {v.location && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', background: '#0e1117', padding: '6px 10px', borderRadius: '6px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          ⚡ {v.location.speed.toFixed(0)} km/h
                        </span>
                        <span>
                          🕒 {new Date(v.location.lastUpdated).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>

      </div>

      {/* Map Panel */}
      <div style={{ flex: 1, position: 'relative', background: '#0d0f14' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

        {/* Speed / Signal Overlay details */}
        {selectedVehicleId && vehicles.find(v => v.id === selectedVehicleId) && (
          (() => {
            const v = vehicles.find(v => v.id === selectedVehicleId)!;
            return (
              <Card style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                background: 'rgba(17, 19, 24, 0.95)',
                borderColor: '#1f2430',
                color: 'white',
                width: '320px',
                zIndex: 20,
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(10px)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <Text style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'white' }}>
                    {v.make} {v.model}
                  </Text>
                  <Button type="text" size="small" onClick={() => setSelectedVehicleId(null)} style={{ color: '#8f9cae' }}>✕</Button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: '#8f9cae' }}>
                  <span><strong>License Plate:</strong> {v.licensePlate}</span>
                  <span><strong>Driver Name:</strong> {v.driver?.name || 'N/A'}</span>
                  <span><strong>Driver Phone:</strong> {v.driver?.phone || 'N/A'}</span>
                  <span><strong>Seating Capacity:</strong> {v.capacity} seats</span>
                  {v.location ? (
                    <>
                      <span><strong>Current Location:</strong> {v.location.lat.toFixed(5)}, {v.location.lng.toFixed(5)}</span>
                      <span><strong>Telemetry Speed:</strong> {v.location.speed.toFixed(1)} km/h</span>
                      <span><strong>Signal Last Update:</strong> {new Date(v.location.lastUpdated).toLocaleTimeString()}</span>
                    </>
                  ) : (
                    <Text style={{ color: '#ef4444', marginTop: '6px' }}>⚠️ Vehicle is currently offline. No live telemetry available.</Text>
                  )}
                </div>
              </Card>
            );
          })()
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

    </div>
  );
}
