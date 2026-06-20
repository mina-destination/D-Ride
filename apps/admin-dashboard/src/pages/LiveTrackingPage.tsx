import { useEffect, useState, useRef, useCallback } from 'react';
import { Search, Navigation, Battery, RefreshCw, LocateFixed } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { io } from 'socket.io-client';
import { vehiclesAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  etaInfo?: {
    nextCheckpoint: string;
    etaMinutes: number;
    distanceMeters: number;
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

function getStatusBadge(status: string) {
  const s = status?.toUpperCase() || '';
  if (s === 'ACTIVE' || s === 'ONLINE') return <Badge variant="success">Active</Badge>;
  if (s === 'IDLE') return <Badge variant="warning">Idle</Badge>;
  if (s === 'OFFLINE' || !s) return <Badge variant="secondary">Offline</Badge>;
  if (s === 'OUT_OF_SERVICE') return <Badge variant="destructive">Out of Service</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function renderLicensePlate(plate: string) {
  if (!plate || plate === 'N/A') return <span className="text-text-muted text-xs">No Plate</span>;
  const isArabic = /[\u0600-\u06FF]/.test(plate);
  return (
    <div className="inline-flex flex-col items-center border border-border/25 rounded bg-black/10 dark:bg-white/5 overflow-hidden shadow-sm min-w-[72px] h-[24px] align-middle">
      <div className="w-full h-1 bg-blue-600" />
      <div
        className="px-1.5 text-[10px] font-extrabold leading-[18px] text-text-primary text-center whitespace-nowrap"
        style={{ direction: isArabic ? 'rtl' : 'ltr', letterSpacing: isArabic ? '1px' : '0.5px' }}
      >
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

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await vehiclesAPI.getAllLocations();
      const mapped: LiveVehicle[] = (res || []).map((v: any) => {
        const locRecord = v.location || v.locations?.[0];
        const coordinates = locRecord?.location?.coordinates || locRecord?.coordinates || null;

        let loc: LiveVehicle['location'] | undefined;
        if (coordinates && Array.isArray(coordinates) && coordinates.length >= 2) {
          const lng = coordinates[0];
          const lat = coordinates[1];
          if (typeof lng === 'number' && typeof lat === 'number' && !isNaN(lng) && !isNaN(lat)) {
            loc = {
              lng,
              lat,
              speed: locRecord?.speedKmh || locRecord?.speed || 0,
              heading: locRecord?.heading,
              batteryLevel: locRecord?.batteryLevel,
              lastUpdated: locRecord?.lastUpdatedAt || locRecord?.timestamp || new Date().toISOString(),
            };
          }
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
      const lng = coords[0];
      const lat = coords[1];
      if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) return;

      setVehicles(prev =>
        prev.map(v => {
          if (v.id === data.vehicleId) {
            return {
              ...v,
              location: {
                lng,
                lat,
                speed: data.location.speed !== undefined ? data.location.speed : (data.speedKmh || 0),
                heading: data.location.heading !== undefined ? data.location.heading : (data.heading || 0),
                batteryLevel: data.location.batteryLevel !== undefined ? data.location.batteryLevel : (data.batteryLevel || null),
                lastUpdated: new Date().toISOString(),
              },
            };
          }
          return v;
        }),
      );
    });

    socket.on('etaUpdate', (data: any) => {
      if (!data?.vehicleId) return;
      setVehicles(prev =>
        prev.map(v => {
          if (v.id === data.vehicleId) {
            return {
              ...v,
              etaInfo: {
                nextCheckpoint: data.nextCheckpoint,
                etaMinutes: data.etaMinutes,
                distanceMeters: data.distanceMeters,
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

  // Subscribe to vehicles when the list changes
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    vehicles.forEach(v => { if (v.id) socket.emit('subscribeToVehicle', v.id); });
  }, [vehicles.length]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    let mapObj: maplibregl.Map | null = new maplibregl.Map({
      container: mapContainerRef.current,
      style: theme === 'dark' ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/positron',
      center: [31.2357, 30.0444],
      zoom: 11,
      attributionControl: false,
    });

    mapObj.on('styleimagemissing', (e) => {
      if (mapObj && !mapObj.hasImage(e.id)) {
        mapObj.addImage(e.id, { width: 16, height: 16, data: new Uint8Array(16 * 16 * 4) });
      }
    });

    mapObj.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    mapObj.on('load', () => {
      if (mapObj) {
        mapRef.current = mapObj;
      }
    });

    return () => {
      if (mapObj) {
        mapObj.remove();
        mapObj = null;
      }
      mapRef.current = null;
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
      if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
        return;
      }
      const isSelected = selectedVehicleId === v.id;
      const rotation = heading !== undefined ? heading : 0;
      const markerColor = isSelected ? '#10b981' : '#F5B731';

      let marker = markersRef.current[v.id];
      if (!marker) {
        const el = document.createElement('div');
        el.className = 'live-vehicle-marker';
        el.style.cssText = `
          width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer;
        `;
        el.innerHTML = `
          <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.35));">
            <circle cx="24" cy="24" r="20" fill="${markerColor}" fill-opacity="0.15" />
            <circle cx="24" cy="24" r="14" fill="${markerColor}" stroke="#1e293b" stroke-width="2.5" />
            <g id="vehicle-chevron" transform="translate(24, 24) rotate(${rotation}) translate(-24, -24)">
              <path d="M24 13L30 29L24 26L18 29L24 13Z" fill="#FFFFFF" stroke-linejoin="round" />
            </g>
          </svg>
        `;

        marker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
        el.addEventListener('click', () => {
          setSelectedVehicleId(v.id);
          map.easeTo({ center: [lng, lat], zoom: 13 });
        });
        markersRef.current[v.id] = marker;
      } else {
        marker.setLngLat([lng, lat]);
        const el = marker.getElement();
        el.innerHTML = `
          <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.35));">
            <circle cx="24" cy="24" r="20" fill="${markerColor}" fill-opacity="0.15" />
            <circle cx="24" cy="24" r="14" fill="${markerColor}" stroke="#1e293b" stroke-width="2.5" />
            <g id="vehicle-chevron" transform="translate(24, 24) rotate(${rotation}) translate(-24, -24)">
              <path d="M24 13L30 29L24 26L18 29L24 13Z" fill="#FFFFFF" stroke-linejoin="round" />
            </g>
          </svg>
        `;
      }

      const popupHtml = `
        <div style="min-width:200px;padding:4px;font-family:Inter,sans-serif;">
          <h4 style="margin:0 0 6px 0;color:#F5B731;font-size:0.95rem;font-weight:bold;">⚡ ${v.make} ${v.model}</h4>
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
    const { lat, lng } = v.location;
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return;
    setSelectedVehicleId(v.id);
    mapRef.current.easeTo({ center: [lng, lat], zoom: 13, duration: 1000 });
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

  return (
    <div className="live-tracking-container flex flex-col lg:flex-row h-[calc(100vh-120px)] m-[-1rem_-2rem] overflow-hidden">
      {/* ── Sidebar Panel ── */}
      <div className="live-tracking-sidebar w-full lg:w-[420px] lg:min-w-[420px] bg-surface border-b lg:border-b-0 lg:border-r border-border flex flex-col z-10">
        <div className="p-6 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2 text-text-primary">
              <span className="w-3.5 h-3.5 rounded-full bg-success animate-pulse inline-block" />
              Live Vehicle Tracking
            </h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[11px] text-text-muted flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin duration-1000" /> live
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <span>Auto-refreshes every 10s</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} · {vehicles.filter(v => v.location).length} online
          </p>
        </div>

        <div className="p-3 px-6 flex gap-2 border-b border-border bg-surface-elevated/40">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              placeholder="Search vehicles, drivers..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full py-1.5 pl-9 pr-3 rounded-lg bg-surface-elevated border border-border text-text-primary text-xs outline-none focus:border-primary transition-colors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="px-2 py-1.5 rounded-lg bg-surface-elevated border border-border text-text-primary text-xs outline-none focus:border-primary transition-colors cursor-pointer"
          >
            <option value="ALL">All</option>
            <option value="ACTIVE">Active</option>
            <option value="IDLE">Idle</option>
            <option value="OFFLINE">Offline</option>
          </select>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {loading && vehicles.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : error && vehicles.length === 0 ? (
            <div className="p-6">
              <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-2">
                <span>⚠️ {error}</span>
              </div>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <span className="text-lg text-text-muted mb-1">🔍</span>
              <span className="text-sm font-semibold text-text-secondary">
                {searchTerm || statusFilter !== 'ALL' ? 'No vehicles match filters' : 'No vehicles found'}
              </span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {filteredVehicles.map(v => {
                const isSelected = selectedVehicleId === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => handleLocate(v)}
                    className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                      isSelected ? "bg-surface-hover" : "hover:bg-surface-hover/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg shadow-sm ${
                          v.location
                            ? "bg-success/10 text-success"
                            : "bg-surface-elevated text-text-muted"
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-text-primary text-sm block truncate">
                          {v.make} {v.model}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          {renderLicensePlate(v.licensePlate)}
                          <span className="text-xs text-text-secondary truncate">
                            👤 {v.driver?.name || 'Unassigned'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      <div className="flex flex-col items-end gap-1">
                        {getStatusBadge(v.status)}
                        {v.location ? (
                          <span className="text-xs font-semibold text-success">
                            {v.location.speed > 0 ? `${v.location.speed.toFixed(0)} km/h` : 'Stopped'}
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted">Offline</span>
                        )}
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={!v.location}
                              onClick={(e) => { e.stopPropagation(); handleLocate(v); }}
                              className={`w-8 h-8 rounded-full ${isSelected ? "text-success bg-success/10" : "text-primary"}`}
                            >
                              <LocateFixed className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <span>Locate on map</span>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Map Panel ── */}
      <div className="live-tracking-map-panel flex-1 relative bg-[#0d0f14]">
        <div ref={mapContainerRef} className="w-full h-full" />

        {selectedVehicle && (
          <Card className="live-tracking-details-card absolute bottom-5 right-5 w-[380px] max-w-[calc(100%-40px)] z-20 bg-slate-900/90 dark:bg-slate-950/90 border border-primary/20 text-white backdrop-blur-md rounded-2xl shadow-2xl">
            <CardContent className="p-4 sm:p-5 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-bold text-sm text-white block leading-tight">
                      {selectedVehicle.make} {selectedVehicle.model}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Capacity: {selectedVehicle.capacity} seats
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedVehicleId(null)}
                  className="w-6 h-6 rounded-full text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border-none"
                >
                  ✕
                </Button>
              </div>

              {selectedVehicle.location ? (
                <div className="flex flex-col gap-3 text-xs text-slate-300">
                  <div className="grid grid-cols-2 gap-3 bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Plate Number</span>
                      <div className="mt-0.5">{renderLicensePlate(selectedVehicle.licensePlate)}</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Driver Partner</span>
                      <span className="font-semibold text-white truncate text-xs">{selectedVehicle.driver?.name || 'Unassigned'}</span>
                      {selectedVehicle.driver?.phone && <span className="text-[10px] text-slate-400">{selectedVehicle.driver.phone}</span>}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Latitude</span>
                      <span className="text-white font-mono text-[11px]">{selectedVehicle.location.lat.toFixed(6)}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Longitude</span>
                      <span className="text-white font-mono text-[11px]">{selectedVehicle.location.lng.toFixed(6)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-black/25 p-3 rounded-lg border border-white/5">
                    <div className="text-center border-r border-white/10">
                      <span className="text-[10px] text-slate-400 uppercase block mb-1">Speed</span>
                      <span className="font-bold text-success text-sm">
                        {selectedVehicle.location.speed.toFixed(0)}
                      </span>
                      <span className="text-[10px] text-slate-400"> km/h</span>
                    </div>
                    <div className="text-center border-r border-white/10 flex flex-col items-center justify-center">
                      <span className="text-[10px] text-slate-400 uppercase block mb-1">Heading</span>
                      <span className="font-bold text-white text-sm flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-primary" style={{ transform: `rotate(${selectedVehicle.location.heading || 0}deg)` }} />
                        {getHeading(selectedVehicle.location.heading)}
                      </span>
                    </div>
                    <div className="text-center flex flex-col items-center justify-center">
                      <span className="text-[10px] text-slate-400 uppercase block mb-1">Battery</span>
                      <span className="font-bold text-sm flex items-center gap-1" style={{ color: getBatteryInfo(selectedVehicle.location.batteryLevel).color }}>
                        <Battery className="w-3.5 h-3.5" />
                        {getBatteryInfo(selectedVehicle.location.batteryLevel).label}
                      </span>
                    </div>
                  </div>

                  {selectedVehicle.etaInfo && (
                    <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-[11px]">Next Checkpoint:</span>
                        <span className="font-bold text-white text-[11px]">{selectedVehicle.etaInfo.nextCheckpoint}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-[11px]">ETA:</span>
                        <span className="font-bold text-blue-400 text-[11px]">{selectedVehicle.etaInfo.etaMinutes} min</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-[11px]">Distance:</span>
                        <span className="font-bold text-white text-[11px]">{(selectedVehicle.etaInfo.distanceMeters / 1000).toFixed(2)} km</span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-success animate-pulse inline-block" />
                      <span className="text-[11px] text-success font-semibold">Active telemetry</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Updated {getRelativeTime(selectedVehicle.location.lastUpdated)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning text-xs font-semibold flex items-center gap-2">
                  <span>⚠️ Vehicle offline. No live telemetry available.</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
