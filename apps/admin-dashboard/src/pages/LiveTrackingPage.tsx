import { useEffect, useState, useRef, useCallback } from 'react';
import { Table, Card, Tag, Button, Spin, Empty, Alert, Typography, Tooltip } from 'antd';
import { Search, Radio, Navigation, Battery, RefreshCw, LocateFixed } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { io } from 'socket.io-client';
import { vehiclesAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const { Title, Text } = Typography;
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const REFRESH_INTERVAL = 10000;

interface LiveVehicle {
  id: string;
  _id: string;
  make: string;
  model: string;
  licensePlate: string;
  status: string;
  capacity: number;
  driver?: { name: string; phone: string; _id?: string };
  location?: {
    lat: number;
    lng: number;
    speed: number;
    heading?: number;
    batteryLevel?: number;
    lastUpdated: string;
  };
}

function getRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return '1 hour ago';
  return `${hours} hours ago`;
}

function getHeading(degrees?: number): string {
  if (degrees === undefined || degrees === null) return '—';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(degrees / 45) % 8];
}

function getBatteryInfo(level?: number): { label: string; color: string } {
  if (level === undefined || level === null) return { label: '—', color: '#8f9cae' };
  if (level >= 70) return { label: `${level}%`, color: '#34d399' };
  if (level >= 30) return { label: `${level}%`, color: '#fbbf24' };
  return { label: `${level}%`, color: '#ef4444' };
}

function getStatusTag(status: string) {
  const s = status?.toUpperCase() || '';
  if (s === 'ACTIVE' || s === 'ONLINE') return <Tag color="success">Active</Tag>;
  if (s === 'IDLE') return <Tag color="warning">Idle</Tag>;
  if (s === 'OFFLINE' || !s) return <Tag>Offline</Tag>;
  if (s === 'OUT_OF_SERVICE') return <Tag color="error">Out of Service</Tag>;
  return <Tag>{status}</Tag>;
}

function renderLicensePlate(plate: string) {
  if (!plate || plate === 'N/A') return <span style={{ color: 'var(--text-muted)' }}>No Plate</span>;
  const isArabic = /[\u0600-\u06FF]/.test(plate);
  return (
    <div style={{
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '4px',
      background: 'rgba(255, 255, 255, 0.05)',
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
      minWidth: '80px',
      height: '26px',
      verticalAlign: 'middle',
    }}>
      <div style={{
        width: '100%',
        height: '6px',
        background: '#1d4ed8', // Egypt-style blue header
      }} />
      <div style={{
        padding: '0 6px',
        color: '#ffffff',
        fontSize: '11px',
        fontWeight: 700,
        lineHeight: '18px',
        textAlign: 'center',
        direction: isArabic ? 'rtl' : 'ltr',
        whiteSpace: 'nowrap',
        letterSpacing: isArabic ? '1px' : '0.5px'
      }}>
        {plate}
      </div>
    </div>
  );
}

export function LiveTrackingPage() {
  const { theme } = useTheme();

  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'IDLE' | 'OFFLINE'>('ALL');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<LiveVehicle | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Record<string, maplibregl.Marker>>({});
  const socketRef = useRef<any>(null);
  const mapInitialized = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await vehiclesAPI.getAllLocations();
      const mapped: LiveVehicle[] = (res || []).map((v: any) => {
        const locRecord = v.location || v.locations?.[0];
        const coordinates = locRecord?.location?.coordinates || locRecord?.coordinates || null;

        let loc: LiveVehicle['location'] | undefined;
        if (coordinates && Array.isArray(coordinates) && coordinates.length >= 2) {
          loc = {
            lng: coordinates[0],
            lat: coordinates[1],
            speed: locRecord?.speedKmh || locRecord?.speed || 0,
            heading: locRecord?.heading,
            batteryLevel: locRecord?.batteryLevel,
            lastUpdated: locRecord?.lastUpdatedAt || locRecord?.timestamp || new Date().toISOString(),
          };
        }

        return {
          id: v._id || v.id,
          _id: v._id || v.id,
          make: v.make || v.vehicle?.make || 'D-Ride',
          model: v.model || v.vehicle?.model || 'Vehicle',
          licensePlate: v.licensePlate || v.vehicle?.plateNumber || v.plateNumber || 'N/A',
          status: v.status || (v.isActive ? 'ACTIVE' : 'OFFLINE'),
          capacity: v.capacity || v.vehicle?.capacity || 14,
          driver: v.driver || v.vehicle?.driver
            ? { name: (v.driver || v.vehicle?.driver)?.name, phone: (v.driver || v.vehicle?.driver)?.phone, _id: (v.driver || v.vehicle?.driver)?._id || (v.driver || v.vehicle?.driver)?.id }
            : undefined,
          location: loc,
        };
      });
      setVehicles(mapped);
    } catch (err: any) {
      // Only show error if there's no cached data to display
      setVehicles(prev => {
        if (prev.length === 0) {
          setError(err?.message || 'Failed to load vehicle locations');
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Connect WebSocket once on mount
  useEffect(() => {
    const token = localStorage.getItem('dride_token');
    if (!token) return;

    const socket = io(SOCKET_URL, {
      path: '/api/socket.io',
      transports: ['polling', 'websocket'],
      auth: { token },
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('vehicleLocationUpdate', (data: any) => {
      if (!data?.vehicleId || !data?.location) return;
      const coords = data.location.coordinates || [data.location.longitude, data.location.latitude];
      if (!Array.isArray(coords) || coords.length < 2) return;

      setVehicles(prev =>
        prev.map(v => {
          if (v.id === data.vehicleId) {
            return {
              ...v,
              location: {
                lng: coords[0],
                lat: coords[1],
                speed: data.speedKmh || 0,
                heading: data.heading,
                batteryLevel: data.batteryLevel,
                lastUpdated: new Date().toISOString(),
              },
            };
          }
          return v;
        }),
      );
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, []);

  // Subscribe to vehicles when the list changes (without reconnecting the socket)
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    vehicles.forEach(v => { if (v.id) socket.emit('subscribeToVehicle', v.id); });
  }, [vehicles.length]);

  useEffect(() => {
    if (!mapContainerRef.current || mapInitialized.current) return;
    mapInitialized.current = true;

    const mapObj = new maplibregl.Map({
      container: mapContainerRef.current,
      style: theme === 'dark' ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/bright',
      center: [31.2357, 30.0444],
      zoom: 11,
      attributionControl: false,
    });

    mapObj.on('styleimagemissing', (e) => {
      if (!mapObj.hasImage(e.id)) {
        mapObj.addImage(e.id, { width: 16, height: 16, data: new Uint8Array(16 * 16 * 4) });
      }
    });

    mapObj.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    mapObj.on('load', () => {
      mapRef.current = mapObj;
    });

    return () => {
      mapInitialized.current = false;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeIds = new Set(vehicles.filter(v => v.location).map(v => v.id));
    Object.keys(markersRef.current).forEach(id => {
      if (!activeIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    vehicles.forEach(v => {
      if (!v.location) return;
      const { lat, lng, speed, lastUpdated, heading } = v.location;
      const isSelected = selectedVehicleId === v.id;

      let marker = markersRef.current[v.id];
      if (!marker) {
        const el = document.createElement('div');
        el.className = 'live-vehicle-marker';
        el.style.cssText = `
          width: 36px; height: 36px; border-radius: 50%;
          background: ${isSelected ? '#10b981' : 'var(--primary-color, #F5B731)'};
          border: 3px solid #1e293b;
          display: flex; align-items: center; justify-content: center;
          color: ${isSelected ? 'white' : 'black'};
          box-shadow: ${isSelected ? '0 0 15px rgba(16,185,129,0.8)' : '0 0 10px rgba(245,183,49,0.5)'};
          cursor: pointer; font-size: 16px;
        `;
        el.innerHTML = '🚌';

        marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
        el.addEventListener('click', () => {
          setSelectedVehicleId(v.id);
          map.easeTo({ center: [lng, lat], zoom: 13 });
        });
        markersRef.current[v.id] = marker;
      } else {
        marker.setLngLat([lng, lat]);
        const el = marker.getElement();
        el.style.background = isSelected ? '#10b981' : 'var(--primary-color, #F5B731)';
        el.style.color = isSelected ? 'white' : 'black';
        el.style.boxShadow = isSelected ? '0 0 15px rgba(16,185,129,0.8)' : '0 0 10px rgba(245,183,49,0.5)';
      }

      const popupHtml = `
        <div style="min-width:200px;padding:4px;font-family:Inter,sans-serif;">
          <h4 style="margin:0 0 6px 0;color:#F5B731;font-size:0.95rem;font-weight:bold;">🚌 ${v.make} ${v.model}</h4>
          <span style="display:block;font-size:11px;margin-bottom:6px;">Plate: <strong>${v.licensePlate}</strong></span>
          <hr style="margin:6px 0;border:none;border-bottom:1px solid #2e374a;" />
          <div style="display:flex;flex-direction:column;gap:4px;font-size:0.8rem;">
            <span><strong>Driver:</strong> ${v.driver?.name || 'No Driver'}</span>
            <span><strong>Speed:</strong> ${speed.toFixed(1)} km/h</span>
            ${heading !== undefined ? `<span><strong>Heading:</strong> ${getHeading(heading)}</span>` : ''}
            <span><strong>Updated:</strong> ${new Date(lastUpdated).toLocaleTimeString()}</span>
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

  useEffect(() => {
    const v = vehicles.find(x => x.id === selectedVehicleId) || null;
    setSelectedVehicle(v);
  }, [selectedVehicleId, vehicles]);

  const handleLocate = (v: LiveVehicle) => {
    if (!v.location || !mapRef.current) return;
    setSelectedVehicleId(v.id);
    mapRef.current.easeTo({ center: [v.location.lng, v.location.lat], zoom: 13, duration: 1000 });
  };

  const filteredVehicles = vehicles.filter(v => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      v.make.toLowerCase().includes(term) ||
      v.model.toLowerCase().includes(term) ||
      v.licensePlate.toLowerCase().includes(term) ||
      v.driver?.name?.toLowerCase().includes(term);

    const isOnline = !!v.location;
    const s = v.status?.toUpperCase() || '';
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && (s === 'ACTIVE' || s === 'ONLINE') && isOnline) ||
      (statusFilter === 'IDLE' && s === 'IDLE') ||
      (statusFilter === 'OFFLINE' && (s === 'OFFLINE' || !isOnline));

    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      title: 'Vehicle Details',
      key: 'details',
      render: (_: any, v: LiveVehicle) => {
        const isSelected = selectedVehicleId === v.id;
        return (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '12px', padding: '6px 0' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: v.location ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                color: v.location ? '#10b981' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: '18px',
                boxShadow: v.location ? '0 0 10px rgba(16, 185, 129, 0.2)' : 'none'
              }}>
                🚌
              </div>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <Text strong style={{ color: 'var(--text-primary)', fontSize: 14, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {v.make} {v.model}
                </Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {renderLicensePlate(v.licensePlate)}
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    👤 {v.driver?.name || 'Unassigned'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                {getStatusTag(v.status)}
                {v.location ? (
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#10b981' }}>
                    {v.location.speed > 0 ? `${v.location.speed.toFixed(0)} km/h` : 'Stopped'}
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Offline</span>
                )}
              </div>
              <Tooltip title="Locate on map">
                <Button
                  type="text"
                  size="small"
                  icon={<LocateFixed size={16} />}
                  onClick={(e) => { e.stopPropagation(); handleLocate(v); }}
                  disabled={!v.location}
                  style={{ 
                    color: isSelected ? '#10b981' : 'var(--primary-color)',
                    background: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                />
              </Tooltip>
            </div>
          </div>
        );
      },
    },
  ];

  const selectedRowKey = selectedVehicleId;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', margin: '-1rem -2rem', overflow: 'hidden' }}>

      {/* ── Sidebar Panel ── */}
      <div style={{
        width: 420,
        minWidth: 420,
        background: 'var(--surface, #111318)',
        borderRight: '1px solid var(--border, #1f2430)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
      }}>
        <div style={{ padding: '1.5rem 1.5rem 0.75rem', borderBottom: '1px solid var(--border, #1f2430)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
              <Radio color="#10b981" size={24} style={{ animation: 'pulse 1.5s infinite' }} />
              Live Vehicle Tracking
            </Title>
            <Tooltip title="Auto-refreshes every 10s">
              <span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                <RefreshCw size={12} /> live
              </span>
            </Tooltip>
          </div>
          <Text style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} · {vehicles.filter(v => v.location).length} online
          </Text>
        </div>

        <div style={{ padding: '0.75rem 1.5rem', display: 'flex', gap: 8, borderBottom: '1px solid var(--border, #1f2430)' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              placeholder="Search vehicles, drivers..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%', padding: '6px 10px 6px 30px', borderRadius: 6,
                background: 'var(--surface-elevated, #171a23)',
                border: '1px solid var(--border, #2e374a)',
                color: 'var(--text-primary)', fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            style={{
              padding: '6px 8px', borderRadius: 6,
              background: 'var(--surface-elevated, #171a23)',
              border: '1px solid var(--border, #2e374a)',
              color: 'var(--text-primary)', fontSize: 13,
              outline: 'none',
            }}
          >
            <option value="ALL">All</option>
            <option value="ACTIVE">Active</option>
            <option value="IDLE">Idle</option>
            <option value="OFFLINE">Offline</option>
          </select>
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {loading && vehicles.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spin size="large" />
            </div>
          ) : error && vehicles.length === 0 ? (
            <div style={{ padding: '1.5rem' }}>
              <Alert message="Error" description={error} type="error" showIcon />
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Empty
                 image={Empty.PRESENTED_IMAGE_SIMPLE}
                 description={searchTerm || statusFilter !== 'ALL' ? 'No vehicles match filters' : 'No vehicles found'}
              />
            </div>
          ) : (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <Table
                dataSource={filteredVehicles}
                columns={columns}
                rowKey="id"
                pagination={false}
                size="small"
                showHeader={false}
                rowClassName={(record) => `live-tracking-row ${selectedRowKey === record.id ? 'selected' : ''}`}
                onRow={(record) => ({
                  onClick: () => handleLocate(record),
                  style: {
                    cursor: 'pointer',
                    background: selectedRowKey === record.id ? 'var(--surface-hover, #1b2230)' : 'transparent',
                    transition: 'background 0.2s',
                  },
                })}
                style={{ minHeight: 200 }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Map Panel ── */}
      <div style={{ flex: 1, position: 'relative', background: '#0d0f14' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

        {selectedVehicle && (
          <Card
            styles={{ body: { padding: '16px 20px' } }}
            style={{
              position: 'absolute',
              bottom: 24,
              left: 24,
              background: 'rgba(15, 23, 42, 0.9)', // Deep slate with high opacity
              border: '1px solid rgba(245, 183, 49, 0.25)', // Primary colored border glow
              color: 'var(--text-primary)',
              width: 360,
              zIndex: 20,
              backdropFilter: 'blur(12px)',
              borderRadius: 16,
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(245, 183, 49, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(245, 183, 49, 0.15)',
                  color: 'var(--primary-color, #F5B731)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px'
                }}>
                  🚌
                </div>
                <div>
                  <Text strong style={{ fontSize: 15, color: '#ffffff', display: 'block', lineHeight: '1.2' }}>
                    {selectedVehicle.make} {selectedVehicle.model}
                  </Text>
                  <Text style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Capacity: {selectedVehicle.capacity} seats
                  </Text>
                </div>
              </div>
              <Button 
                type="text" 
                size="small" 
                onClick={() => setSelectedVehicleId(null)} 
                style={{ 
                  color: 'var(--text-secondary)', 
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
              >
                ✕
              </Button>
            </div>

            {selectedVehicle.location ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px 14px', background: 'rgba(255, 255, 255, 0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Plate Number</Text>
                    <div style={{ marginTop: '2px' }}>{renderLicensePlate(selectedVehicle.licensePlate)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Driver Partner</Text>
                    <Text strong style={{ color: '#ffffff', fontSize: 13 }}>{selectedVehicle.driver?.name || 'Unassigned'}</Text>
                    {selectedVehicle.driver?.phone && <Text style={{ fontSize: 10, color: 'var(--text-muted)' }}>{selectedVehicle.driver.phone}</Text>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Latitude</Text>
                    <Text style={{ color: '#ffffff', fontFamily: 'monospace', fontSize: 12 }}>{selectedVehicle.location.lat.toFixed(6)}</Text>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Longitude</Text>
                    <Text style={{ color: '#ffffff', fontFamily: 'monospace', fontSize: 12 }}>{selectedVehicle.location.lng.toFixed(6)}</Text>
                  </div>
                </div>

                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
                  background: 'rgba(14, 17, 23, 0.6)',
                  padding: '12px', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <Text type="secondary" style={{ fontSize: 10, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Speed</Text>
                    <Text strong style={{ color: '#10b981', fontSize: 16 }}>
                      {selectedVehicle.location.speed.toFixed(0)}
                    </Text>
                    <Text style={{ color: 'var(--text-muted)', fontSize: 10 }}> km/h</Text>
                  </div>
                  <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <Text type="secondary" style={{ fontSize: 10, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Heading</Text>
                    <Text strong style={{ color: '#ffffff', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <Navigation size={13} style={{ transform: `rotate(${selectedVehicle.location.heading || 0}deg)`, color: 'var(--primary-color)' }} />
                      {getHeading(selectedVehicle.location.heading)}
                    </Text>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 10, display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Battery</Text>
                    <Text strong style={{ color: getBatteryInfo(selectedVehicle.location.batteryLevel).color, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <Battery size={13} />
                      {getBatteryInfo(selectedVehicle.location.batteryLevel).label}
                    </Text>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                    <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>Active telemetry</span>
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Updated {getRelativeTime(selectedVehicle.location.lastUpdated)}
                  </Text>
                </div>
              </div>
            ) : (
              <Alert message="Vehicle offline" description="No live telemetry available." type="warning" showIcon style={{ fontSize: 12 }} />
            )}
          </Card>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
        .live-tracking-row {
          transition: background 0.2s !important;
        }
        .live-tracking-row:hover {
          background: var(--surface-hover) !important;
        }
        .live-tracking-row.selected {
          background: var(--surface-hover) !important;
        }
        .live-tracking-row td {
          padding: 8px 12px !important;
          border-bottom: 1px solid var(--border, #232938) !important;
        }
        .ant-table-wrapper {
          background: transparent !important;
        }
        .ant-table {
          background: transparent !important;
        }
        .ant-table-thead > tr > th {
          display: none !important;
        }
        .ant-table-tbody > tr > td {
          background: transparent !important;
        }
      `}</style>

    </div>
  );
}
