import { useEffect, useState, useRef } from 'react';
import { Table, Input, Card, DatePicker, Select, Tag, Button, Slider, Space, Empty, Badge } from 'antd';
import { Play, Pause, RotateCcw, Clock, ArrowRight, Compass } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { tripsAPI } from '../services/api';
import dayjs from 'dayjs';

interface TripTelemetry {
  id: string;
  _id: string;
  departureTime: string;
  arrivalTime?: string;
  status: string;
  driver?: { name: string; email: string };
  vehicle?: { model: string; plateNumber: string };
  routeId?: {
    name: string;
    coverImage?: string;
    estimatedDurationMinutes?: number;
    path?: {
      type: string;
      coordinates: [number, number][];
    };
    checkpoints?: any[];
  };
  actualPath?: [number, number][]; // [[lng, lat], ...]
}

export function TripHistoryPage() {
  const [trips, setTrips] = useState<TripTelemetry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState<TripTelemetry | null>(null);
  
  // Filtering states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Map states
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  
  // Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // multiplier
  const playbackIntervalRef = useRef<any>(null);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const mapMarkersRef = useRef<maplibregl.Marker[]>([]);

  // Fetch trips
  const fetchTrips = async () => {
    try {
      setLoading(true);
      const res = await tripsAPI.getAll();
      // Filter out trips that have no route configuration just in case
      const validTrips = (res || []).filter((t: any) => t.routeId);
      setTrips(validTrips);
      
      // Auto-select the first completed trip if available
      const completed = validTrips.find((t: any) => t.status === 'COMPLETED');
      if (completed) {
        setSelectedTrip(completed);
      } else if (validTrips.length > 0) {
        setSelectedTrip(validTrips[0]);
      }
    } catch (err) {
      console.error('Failed to load trips history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Detect if dark mode is active
    const isDark = document.body.classList.contains('dark') || 
                   document.documentElement.classList.contains('dark') ||
                   document.body.getAttribute('data-theme') === 'dark';

    const mapObj = new maplibregl.Map({
      container: mapContainerRef.current,
      style: isDark ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/bright',
      center: [31.2357, 30.0444], // Cairo Default
      zoom: 10,
      attributionControl: false
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
      setMap(mapObj);
      mapRef.current = mapObj;
    });

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMap(null);
      }
    };
  }, []);

  // Render Planned Route & Actual Path when selected trip changes
  useEffect(() => {
    if (!map || !selectedTrip) return;

    // Stop existing playback
    setIsPlaying(false);
    setPlaybackIndex(0);
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }

    // Clear old driver marker
    if (driverMarkerRef.current) {
      driverMarkerRef.current.remove();
      driverMarkerRef.current = null;
    }

    // Clear old checkpoint markers
    mapMarkersRef.current.forEach(marker => marker.remove());
    mapMarkersRef.current = [];

    // Clear old layers/sources
    if (map.getLayer('planned-route-layer')) map.removeLayer('planned-route-layer');
    if (map.getSource('planned-route')) map.removeSource('planned-route');
    if (map.getLayer('actual-route-layer')) map.removeLayer('actual-route-layer');
    if (map.getSource('actual-route')) map.removeSource('actual-route');

    const plannedCoords = selectedTrip.routeId?.path?.coordinates || [];
    // Ensure actualPath coordinates are valid arrays
    let actualCoords: [number, number][] = [];
    if (selectedTrip.actualPath) {
      try {
        actualCoords = typeof selectedTrip.actualPath === 'string'
          ? JSON.parse(selectedTrip.actualPath)
          : (selectedTrip.actualPath as any);
      } catch (e) {
        actualCoords = [];
      }
    }
    if (!Array.isArray(actualCoords)) {
      actualCoords = [];
    }

    const bounds = new maplibregl.LngLatBounds();
    let hasCoords = false;

    // 1. Add Planned Route Layer (Solid blue line)
    if (plannedCoords.length > 0) {
      map.addSource('planned-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: plannedCoords
          }
        }
      });

      map.addLayer({
        id: 'planned-route-layer',
        type: 'line',
        source: 'planned-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 4.5,
          'line-opacity': 0.7
        }
      });

      plannedCoords.forEach(coord => {
        bounds.extend(coord);
      });
      hasCoords = true;
    }

    // 2. Add Actual Path Layer (Emerald dashed line)
    if (actualCoords.length > 0) {
      map.addSource('actual-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: actualCoords
          }
        }
      });

      map.addLayer({
        id: 'actual-route-layer',
        type: 'line',
        source: 'actual-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#10b981',
          'line-width': 5,
          'line-opacity': 0.85,
          'line-dasharray': [2, 2]
        }
      });

      actualCoords.forEach(coord => {
        bounds.extend(coord);
      });
      hasCoords = true;
    }

    // 3. Render Checkpoints
    const checkpoints = selectedTrip.routeId?.checkpoints || [];
    checkpoints.forEach((cp, idx) => {
      const isStart = cp.type === 'START';
      const isEnd = cp.type === 'END';
      const coords = cp.location?.coordinates;
      if (!coords) return;

      const el = document.createElement('div');
      el.className = isStart ? 'google-maps-start-pin' : isEnd ? 'google-maps-dest-pin' : 'google-maps-stop-pin';
      if (!isStart && !isEnd) {
        el.innerText = `${idx}`;
        el.style.fontSize = '9px';
      }

      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
        <div style="font-family: Inter, sans-serif; padding: 4px; color: var(--text-primary);">
          <strong style="display: block; font-size: 13px;">${cp.name}</strong>
          <span style="font-size: 11px; color: var(--text-secondary);">${cp.city || ''}</span>
          <hr style="margin: 6px 0; border: none; border-bottom: 1px solid var(--border);" />
          <span style="font-size: 10px; color: var(--text-muted);">
            Type: ${cp.type}<br/>
            Buffer Time: ${cp.bufferTimeMinutes || 0} mins
          </span>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([coords[0], coords[1]])
        .setPopup(popup)
        .addTo(map);

      mapMarkersRef.current.push(marker);
    });

    // Fit bounds dynamically
    if (hasCoords) {
      map.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 800 });
    }
  }, [map, selectedTrip]);

  // Manage Playback Animation
  useEffect(() => {
    if (!map || !selectedTrip) return;

    let actualCoords: [number, number][] = [];
    if (selectedTrip.actualPath) {
      try {
        actualCoords = typeof selectedTrip.actualPath === 'string'
          ? JSON.parse(selectedTrip.actualPath)
          : (selectedTrip.actualPath as any);
      } catch (e) {
        actualCoords = [];
      }
    }
    if (!Array.isArray(actualCoords) || actualCoords.length === 0) return;

    if (isPlaying) {
      // Create driver vehicle marker if it doesn't exist
      if (!driverMarkerRef.current) {
        const el = document.createElement('div');
        el.style.width = '36px';
        el.style.height = '36px';
        el.style.borderRadius = '50%';
        el.style.background = 'var(--primary-color, #F5B731)';
        el.style.border = '3px solid #1e293b';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.color = 'black';
        el.style.boxShadow = '0 0 15px rgba(245, 183, 49, 0.6)';
        el.innerHTML = '🚌';
        
        driverMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat(actualCoords[playbackIndex])
          .addTo(map);
      }

      const intervalMs = Math.max(100, 1000 / playbackSpeed);

      playbackIntervalRef.current = setInterval(() => {
        setPlaybackIndex(prev => {
          const next = prev + 1;
          if (next >= actualCoords.length) {
            setIsPlaying(false);
            clearInterval(playbackIntervalRef.current);
            return prev;
          }
          if (driverMarkerRef.current) {
            driverMarkerRef.current.setLngLat(actualCoords[next]);
            // Pan map to follow driver
            map.panTo(actualCoords[next], { duration: intervalMs - 20 });
          }
          return next;
        });
      }, intervalMs);
    } else {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
    }

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, map, selectedTrip]);

  const handleResetPlayback = () => {
    setIsPlaying(false);
    setPlaybackIndex(0);
    
    let actualCoords: [number, number][] = [];
    if (selectedTrip?.actualPath) {
      try {
        actualCoords = typeof selectedTrip.actualPath === 'string'
          ? JSON.parse(selectedTrip.actualPath)
          : (selectedTrip.actualPath as any);
      } catch (e) {
        actualCoords = [];
      }
    }

    if (driverMarkerRef.current && actualCoords.length > 0) {
      driverMarkerRef.current.setLngLat(actualCoords[0]);
      map?.panTo(actualCoords[0]);
    }
  };

  const getActualCoords = (trip: TripTelemetry | null): [number, number][] => {
    if (!trip || !trip.actualPath) return [];
    try {
      const parsed = typeof trip.actualPath === 'string'
        ? JSON.parse(trip.actualPath)
        : trip.actualPath;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  // Filter trips
  const filteredTrips = trips.filter(t => {
    const matchesSearch = t.routeId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.driver?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.vehicle?.plateNumber?.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    
    let matchesDate = true;
    if (dateFilter) {
      const filterDay = dayjs(dateFilter).startOf('day');
      const tripDay = dayjs(t.departureTime).startOf('day');
      matchesDate = filterDay.isSame(tripDay);
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  const columns = [
    {
      title: 'Route Name',
      dataIndex: ['routeId', 'name'],
      key: 'routeName',
      render: (text: string) => (
        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {text}
        </div>
      )
    },
    {
      title: 'Departure Time',
      dataIndex: 'departureTime',
      key: 'departureTime',
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
      sorter: (a: TripTelemetry, b: TripTelemetry) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime()
    },
    {
      title: 'Driver / Vehicle',
      key: 'driverVehicle',
      render: (_: any, record: TripTelemetry) => (
        <div style={{ fontSize: '12px' }}>
          <div>👤 {record.driver?.name || 'Unassigned'}</div>
          <div style={{ color: 'var(--text-muted)' }}>🚌 {record.vehicle?.plateNumber || 'N/A'}</div>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'blue';
        if (status === 'COMPLETED') color = 'success';
        if (status === 'IN_TRANSIT') color = 'processing';
        if (status === 'CANCELLED') color = 'error';
        return <Tag color={color}>{status}</Tag>;
      }
    },
    {
      title: 'GPS Points',
      key: 'telemetryPoints',
      render: (_: any, record: TripTelemetry) => {
        const coords = getActualCoords(record);
        return (
          <Badge 
            count={`${coords.length} pts`} 
            style={{ 
              backgroundColor: coords.length > 0 ? '#10b981' : 'var(--border)', 
              color: coords.length > 0 ? 'white' : 'var(--text-muted)' 
            }} 
          />
        );
      }
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'calc(100vh - 110px)' }}>
      {/* 📊 Analytics Dashboard Style Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px', flex: 1, minHeight: 0 }}>
        
        {/* Left column: List & Search Panel */}
        <Card 
          style={{ 
            background: 'var(--surface-elevated)', 
            border: '1px solid var(--border)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: 0
          }}
          styles={{ 
            body: {
              display: 'flex', 
              flexDirection: 'column', 
              height: '100%',
              padding: '16px'
            }
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--primary-color)' }}>
              Completed & Live Trips Telemetry
            </h3>
            
            <Input 
              placeholder="Search driver, route, plate..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              allowClear
            />
            
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
              <DatePicker 
                placeholder="Filter by Date" 
                value={dateFilter} 
                onChange={setDateFilter}
                style={{ width: '100%' }}
              />
              <Select 
                value={statusFilter} 
                onChange={setStatusFilter}
                style={{ width: '100%' }}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'COMPLETED', label: 'Completed' },
                  { value: 'IN_TRANSIT', label: 'In Transit' }
                ]}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
            <Table
              dataSource={filteredTrips}
              columns={columns}
              rowKey="_id"
              pagination={false}
              loading={loading}
              size="small"
              onRow={(record) => ({
                onClick: () => setSelectedTrip(record),
                style: { 
                  cursor: 'pointer',
                  background: selectedTrip?._id === record._id ? 'rgba(245, 183, 49, 0.08)' : undefined
                }
              })}
              locale={{
                emptyText: <Empty description="No telemetry logs found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              }}
            />
          </div>
        </Card>

        {/* Right column: Playback Map and Trip Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
          
          {selectedTrip && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <Card size="small" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Route</span>
                <div style={{ fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedTrip.routeId?.name}
                </div>
              </Card>
              <Card size="small" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Assigned Driver</span>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>
                  👤 {selectedTrip.driver?.name || 'N/A'}
                </div>
              </Card>
              <Card size="small" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Duration (Est vs Actual)</span>
                <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} style={{ color: 'var(--primary-color)' }} />
                  <span>
                    {selectedTrip.routeId?.estimatedDurationMinutes || 0}m
                  </span>
                  <ArrowRight size={10} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: selectedTrip.arrivalTime ? '#10b981' : 'var(--text-muted)' }}>
                    {selectedTrip.arrivalTime 
                      ? `${Math.round((new Date(selectedTrip.arrivalTime).getTime() - new Date(selectedTrip.departureTime).getTime()) / 60000)}m` 
                      : 'Live'}
                  </span>
                </div>
              </Card>
              <Card size="small" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Coordinates Captured</span>
                <div style={{ fontWeight: 700, fontSize: '14px', color: '#10b981' }}>
                  📈 {getActualCoords(selectedTrip).length} points
                </div>
              </Card>
            </div>
          )}

          {/* Map & Playback Interface */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            
            {/* Map Container */}
            <div ref={mapContainerRef} style={{ width: '100%', flex: 1 }} />

            {/* Floating Legends */}
            <div style={{ 
              position: 'absolute', 
              top: '12px', 
              left: '12px', 
              background: 'rgba(30, 41, 59, 0.85)', 
              backdropFilter: 'blur(8px)',
              padding: '10px 14px', 
              borderRadius: '8px', 
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              zIndex: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'white' }}>
                <span style={{ width: '12px', height: '3px', background: '#3b82f6', borderRadius: '1px' }} />
                <span>Planned Route Schedule</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'white' }}>
                <span style={{ width: '12px', height: '3px', borderTop: '2px dashed #10b981' }} />
                <span>Driver Telemetry Trace</span>
              </div>
            </div>

            {/* Playback Controls Panel */}
            {selectedTrip && getActualCoords(selectedTrip).length > 0 && (
              <div style={{ 
                background: 'rgba(15, 23, 42, 0.9)', 
                backdropFilter: 'blur(10px)',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '20px',
                zIndex: 10
              }}>
                <Space size="middle">
                  <Button 
                    type="primary" 
                    icon={isPlaying ? <Pause size={16} /> : <Play size={16} />} 
                    onClick={() => setIsPlaying(!isPlaying)}
                    style={{ background: 'var(--primary-color)', color: 'black', fontWeight: 600 }}
                  >
                    {isPlaying ? 'Pause' : 'Play Route'}
                  </Button>
                  
                  <Button 
                    icon={<RotateCcw size={16} />} 
                    onClick={handleResetPlayback} 
                    style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.15)', color: 'white' }}
                  />
                </Space>

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    Playback Timeline
                  </span>
                  <Slider 
                    min={0}
                    max={getActualCoords(selectedTrip).length - 1}
                    value={playbackIndex}
                    onChange={(val) => {
                      setPlaybackIndex(val);
                      const coords = getActualCoords(selectedTrip);
                      if (driverMarkerRef.current && coords[val]) {
                        driverMarkerRef.current.setLngLat(coords[val]);
                        map?.panTo(coords[val]);
                      }
                    }}
                    style={{ flex: 1 }}
                    tooltip={{
                      formatter: (val) => `Point ${Number(val) + 1} of ${getActualCoords(selectedTrip).length}`
                    }}
                  />
                  <span style={{ fontSize: '11px', color: '#94a3b8', minWidth: '40px', textAlign: 'right' }}>
                    {playbackIndex + 1}/{getActualCoords(selectedTrip).length}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '180px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    Speed
                  </span>
                  <Select 
                    value={playbackSpeed} 
                    onChange={setPlaybackSpeed}
                    style={{ width: '80px' }}
                    dropdownStyle={{ background: '#1e293b' }}
                    options={[
                      { value: 1, label: '1x' },
                      { value: 2, label: '2x' },
                      { value: 5, label: '5x' },
                      { value: 10, label: '10x' }
                    ]}
                  />
                </div>
              </div>
            )}
            
            {/* If no telemetry coords */}
            {selectedTrip && getActualCoords(selectedTrip).length === 0 && (
              <div style={{ 
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0, 0, 0, 0.75)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                zIndex: 10,
                color: 'white',
                padding: '20px',
                textAlign: 'center'
              }}>
                <Compass size={40} className="lucide-animate-spin" style={{ color: 'var(--text-muted)' }} />
                <h4 style={{ margin: 0, color: 'white' }}>No Driver GPS Data Available</h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', maxWidth: '300px' }}>
                  This trip has not recorded any coordinate telemetry yet. Set a trip to "In Transit" and run a simulation to collect coordinates.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
