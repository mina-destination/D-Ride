import { useEffect, useState, useMemo, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Bus, CarFront, Banknote, Users, CreditCard, Activity, Flame, Ticket } from 'lucide-react';
import { bookingsAPI, tripsAPI, vehiclesAPI, usersAPI } from '../services/api';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api$/, '');

interface ActiveBus {
  id: string;
  vehicleId?: string;
  plate: string;
  route: string;
  driver: string;
  driverId?: string;
  lat: number;
  lng: number;
  seats: string;
  speed: number;
  status: string;
}

// Helper functions to draw smooth bezier curves through exact points
const getLinePath = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return '';
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x},${p2.y}`;
  }
  return d;
};

const getAreaPath = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return '';
  const line = getLinePath(points);
  return `${line} L ${points[points.length - 1].x},130 L ${points[0].x},130 Z`;
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [fleet, setFleet] = useState<ActiveBus[]>([]);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [mapPanTo, setMapPanTo] = useState<[number, number] | null>(null);

  // Sandbox live driving simulation states for admin testing
  const [simulatingBusId, setSimulatingBusId] = useState<string | null>(null);
  const simIntervalRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
      }
    };
  }, []);

  // OSRM street path and Heatmap states
  const [selectedRoutePath, setSelectedRoutePath] = useState<[number, number][]>([]);
  const [mapViewMode, setMapViewMode] = useState<'FLEET' | 'HEATMAP'>('FLEET');
  const [bookings, setBookings] = useState<any[]>([]);

  // Interactive Chart States
  const [bookingsRange, setBookingsRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [hoveredBookingPoint, setHoveredBookingPoint] = useState<any>(null);
  const [revenueRegion, setRevenueRegion] = useState<'ALL' | 'CAIRO' | 'GIZA' | 'ALEX'>('ALL');
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [hoveredDonutSector, setHoveredDonutSector] = useState<string | null>(null);

  const [allTrips, setAllTrips] = useState<any[]>([]);
  const [allVehicles, setAllVehicles] = useState<any[]>([]);
  const [passengersCount, setPassengersCount] = useState<number>(0);

  // Fetch bookings and passenger count
  useEffect(() => {
    bookingsAPI.getAll()
      .then(data => setBookings(data))
      .catch(console.error);

    usersAPI.getByRole('PASSENGER')
      .then(data => setPassengersCount(data.length))
      .catch((err) => {
        console.error(err);
        setPassengersCount(12); // Fallback
      });
  }, []);

  // Initialize MapLibre Map for Fleet tracking & Heatmap
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const mapObj = new maplibregl.Map({
      container: mapContainerRef.current,
      style: theme === 'dark' ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/bright',
      center: [31.2357, 30.0444],
      zoom: 11,
      attributionControl: false
    });

    // Suppress missing sprite image warnings by providing dummy transparent images
    mapObj.on('styleimagemissing', (e) => {
      const width = 16;
      const height = 16;
      const data = new Uint8Array(width * height * 4); // transparent pixels
      if (!mapObj.hasImage(e.id)) {
        mapObj.addImage(e.id, { width, height, data });
      }
    });

    mapRef.current = mapObj;
    setMap(mapObj);
    mapObj.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    return () => {
      mapObj.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, [theme]);

  // Synchronize Markers (Fleet Active Shuttles or Hotspot Heatmaps)
  useEffect(() => {
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (mapViewMode === 'FLEET') {
      fleet.forEach((bus) => {
        const el = document.createElement('div');
        el.className = 'google-maps-bus-pointer';

        const popupHtml = `
          <div style="min-width: 180px; padding: 0.25rem; font-family: Inter, sans-serif; color: var(--text-primary);">
            <h4 style="margin: 0 0 0.5rem 0; color: var(--primary-color, #F5B731); font-size: 0.95rem; font-weight: bold;">
              Shuttle ${bus.plate}
            </h4>
            <div style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem;">
              <span><strong>Driver:</strong> ${bus.driver}</span>
              <span><strong>Route:</strong> ${bus.route}</span>
              <span><strong>Speed:</strong> ${bus.speed} km/h</span>
              <span><strong>Occupancy:</strong> ${bus.seats} booked</span>
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 15 }).setHTML(popupHtml);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([bus.lng, bus.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    } else if (mapViewMode === 'HEATMAP') {
      bookings
        .filter((b) => b.pickupCheckpoint)
        .forEach((booking) => {
          const pickup = booking.pickupCheckpoint;
          const coords = pickup.location?.coordinates || pickup.coordinates;
          if (!coords || coords.length < 2) return;

          const el = document.createElement('div');
          el.className = 'demand-heatmap-marker';
          el.innerHTML = `
            <div style="
              width: 24px;
              height: 24px;
              border-radius: 50%;
              background: rgba(239, 68, 68, 0.4);
              border: 1.5px solid #f59e0b;
              box-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
            "></div>
          `;

          const popupHtml = `
            <div style="padding: 0.15rem; font-family: Inter, sans-serif; color: var(--text-primary);">
              <h4 style="margin: 0 0 4px 0; font-size: 0.95rem; color: #ef4444; font-weight: bold;">Demand Area Hotspot</h4>
              <div style="font-size: 0.78rem;">
                <strong>Station:</strong> ${pickup.name}<br />
                <strong>Fare:</strong> ${booking.amountEGP} EGP<br />
                <strong>Status:</strong> ${booking.status}
              </div>
            </div>
          `;

          const popup = new maplibregl.Popup({ offset: 10 }).setHTML(popupHtml);

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([coords[0], coords[1]])
            .setPopup(popup)
            .addTo(map);

          markersRef.current.push(marker);
        });
    }
  }, [map, fleet, bookings, mapViewMode]);

  // Synchronize Selected Bus Polyline
  useEffect(() => {
    if (!map) return;

    const updatePath = () => {
      const coords = selectedBusId && selectedRoutePath.length > 0
        ? selectedRoutePath.map(p => [p[1], p[0]])
        : [];

      const geoJsonData: any = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coords
        }
      };

      const source = map.getSource('selected-bus-path') as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(geoJsonData);
      } else {
        map.addSource('selected-bus-path', {
          type: 'geojson',
          data: geoJsonData
        });

        map.addLayer({
          id: 'selected-bus-path-layer',
          type: 'line',
          source: 'selected-bus-path',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': theme === 'dark' ? '#8ab4f8' : '#1a73e8',
            'line-width': 5,
            'line-opacity': 0.9,
            'line-dasharray': [2, 2]
          }
        });
      }
    };

    if (map.isStyleLoaded()) {
      updatePath();
    } else {
      map.on('load', updatePath);
      map.on('style.load', updatePath);
    }
  }, [map, selectedRoutePath, selectedBusId, theme]);

  // Handle mapPanTo flight
  useEffect(() => {
    if (map && mapPanTo) {
      map.panTo([mapPanTo[1], mapPanTo[0]]);
    }
  }, [map, mapPanTo]);

  // Format "time ago" string
  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const diffMs = new Date().getTime() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hr ago';
    if (diffHours < 24) return `${diffHours} hrs ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'yesterday';
    return `${diffDays} days ago`;
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Occupancy stats calculation
  const occupancyStats = useMemo(() => {
    const activeTrips = allTrips.filter(t => t.status !== 'CANCELLED' && t.status !== 'COMPLETED');
    const tripsToCalculate = activeTrips.length > 0 ? activeTrips : allTrips.filter(t => t.status !== 'CANCELLED');
    
    let totalBooked = 0;
    let totalAvailable = 0;
    
    tripsToCalculate.forEach(t => {
      totalBooked += t.bookedSeats || 0;
      totalAvailable += t.availableSeats || 14;
    });

    if (totalAvailable === 0) totalAvailable = 14;

    const bookedPercentage = Math.round((totalBooked / totalAvailable) * 100) || 0;
    const freeSeats = Math.max(0, totalAvailable - totalBooked);
    const freePercentage = Math.max(0, 100 - bookedPercentage);
    
    const avgLoad = tripsToCalculate.length > 0
      ? Math.round(tripsToCalculate.reduce((sum, t) => sum + ((t.bookedSeats || 0) / (t.availableSeats || 14) * 100), 0) / tripsToCalculate.length)
      : 0;

    return {
      totalBooked,
      totalAvailable,
      freeSeats,
      bookedPercentage,
      freePercentage,
      avgLoad
    };
  }, [allTrips]);

  // Recent Bookings memo
  const recentBookings = useMemo(() => {
    return [...bookings]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);
  }, [bookings]);

  // Recent Activities memo
  const recentActivities = useMemo(() => {
    const activities: { id: string; type: 'booking' | 'trip' | 'vehicle'; text: React.ReactNode; date: Date; icon: React.ReactNode }[] = [];

    // 1. Process Bookings
    bookings.forEach(b => {
      const name = b.userId?.name || 'Passenger';
      const routeName = b.tripId?.routeId?.name || 'Route';
      const time = new Date(b.createdAt || b.updatedAt);
      
      if (b.paymentStatus === 'SUCCESS') {
        activities.push({
          id: `pay-${b._id}`,
          type: 'booking',
          text: <span><strong>Payment received</strong> — EGP {b.amountEGP} from {name} via Paymob</span>,
          date: time,
          icon: <CreditCard size={16} />
        });
      } else {
        activities.push({
          id: `book-${b._id}`,
          type: 'booking',
          text: <span><strong>Seat reserved</strong> — {name} booked seat on {routeName}</span>,
          date: time,
          icon: <Ticket size={16} />
        });
      }
    });

    // 2. Process Trips
    allTrips.forEach(t => {
      const routeName = t.routeId?.name || 'Route';
      const tripIdShort = t._id.slice(-6).toUpperCase();
      const time = new Date(t.updatedAt || t.departureTime);

      if (t.status === 'IN_TRANSIT') {
        activities.push({
          id: `transit-${t._id}`,
          type: 'trip',
          text: <span><strong>Trip #{tripIdShort}</strong> departed on schedule on line {routeName}</span>,
          date: time,
          icon: <Bus size={16} />
        });
      } else if (t.status === 'BOARDING') {
        activities.push({
          id: `board-${t._id}`,
          type: 'trip',
          text: <span><strong>Boarding gates open</strong> for Trip #{tripIdShort} ({routeName})</span>,
          date: time,
          icon: <Bus size={16} />
        });
      } else if (t.status === 'COMPLETED') {
        activities.push({
          id: `complete-${t._id}`,
          type: 'trip',
          text: <span><strong>Trip #{tripIdShort}</strong> successfully completed its run</span>,
          date: time,
          icon: <Activity size={16} />
        });
      }
    });

    // 3. Process Vehicles
    allVehicles.forEach(v => {
      const plate = v.licensePlate || 'N/A';
      const make = v.make || 'Shuttle';
      const time = new Date(v.updatedAt || new Date());
      
      if (v.isActive) {
        activities.push({
          id: `veh-${v._id}`,
          type: 'vehicle',
          text: <span><strong>Vehicle {plate}</strong> ({make}) status updated to Active</span>,
          date: time,
          icon: <CarFront size={16} />
        });
      }
    });

    return activities
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 5);
  }, [bookings, allTrips, allVehicles]);

  // Dynamic line chart generator
  const getDynamicBookingsData = () => {
    const xCoords = [15, 95, 175, 255, 335, 415, 485];
    const now = new Date();
    
    let rawPoints: { label: string; x: number; count: number }[];
    if (bookingsRange === 'daily') {
      rawPoints = xCoords.map((x, i) => {
        const hoursAgo = (6 - i) * 3;
        const targetDate = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
        const label = `${targetDate.getHours().toString().padStart(2, '0')}:00`;
        const count = bookings.filter(b => {
          const bDate = new Date(b.createdAt);
          const diffHours = (now.getTime() - bDate.getTime()) / (1000 * 60 * 60);
          return diffHours >= hoursAgo && diffHours < hoursAgo + 3;
        }).length;
        return { label, x, count };
      });
    } else if (bookingsRange === 'weekly') {
      rawPoints = xCoords.map((x, i) => {
        const daysAgo = 6 - i;
        const targetDate = new Date();
        targetDate.setDate(now.getDate() - daysAgo);
        const label = targetDate.toLocaleDateString([], { weekday: 'short' });
        const count = bookings.filter(b => {
          const bDate = new Date(b.createdAt);
          return bDate.toDateString() === targetDate.toDateString();
        }).length;
        return { label, x, count };
      });
    } else {
      rawPoints = xCoords.map((x, i) => {
        const monthsAgo = 6 - i;
        const targetDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
        const label = targetDate.toLocaleDateString([], { month: 'short' });
        const count = bookings.filter(b => {
          const bDate = new Date(b.createdAt);
          return bDate.getMonth() === targetDate.getMonth() && bDate.getFullYear() === targetDate.getFullYear();
        }).length;
        return { label, x, count };
      });
    }

    const maxCount = Math.max(...rawPoints.map(p => p.count), 5);
    const points = rawPoints.map(p => {
      const y = 130 - (p.count / maxCount) * 100;
      return { ...p, y };
    });

    return {
      points,
      areaPath: getAreaPath(points),
      linePath: getLinePath(points),
      growth: bookingsRange === 'daily'
        ? `Live checkout activity today`
        : bookingsRange === 'weekly'
          ? `Total bookings: ${bookings.length}`
          : `Monthly booking transaction metrics`
    };
  };

  const dynamicBookings = getDynamicBookingsData();

  // Dynamic revenue bar chart generator
  const getDynamicRevenueBars = () => {
    const locations = [
      { city: 'Cairo', region: 'CAIRO', color: 'var(--primary)', x: 25, w: 28, keywords: ['cairo', 'ramses'] },
      { city: 'Giza', region: 'GIZA', color: 'var(--success)', x: 105, w: 28, keywords: ['giza', 'pyramids'] },
      { city: 'Alex', region: 'ALEX', color: 'var(--info)', x: 185, w: 28, keywords: ['alexandria', 'alex'] },
      { city: 'Maadi', region: 'CAIRO', color: 'var(--warning)', x: 265, w: 28, keywords: ['maadi'] },
      { city: 'Helio', region: 'CAIRO', color: 'var(--primary)', x: 345, w: 28, keywords: ['helio', 'abbassia'] },
      { city: 'Oct', region: 'GIZA', color: 'var(--text-secondary)', x: 425, w: 28, keywords: ['october', 'oct'] }
    ];

    const bars = locations.map(loc => {
      const val = bookings
        .filter(b => b.status === 'CONFIRMED' || b.status === 'COMPLETED' || b.paymentStatus === 'SUCCESS')
        .filter(b => {
          const routeName = b.tripId?.routeId?.name?.toLowerCase() || '';
          return loc.keywords.some(k => routeName.includes(k));
        })
        .reduce((sum, b) => sum + (b.amountEGP || 0), 0);
      return { ...loc, val };
    });

    const maxVal = Math.max(...bars.map(b => b.val), 1000);
    return bars.map(b => {
      const h = Math.max(10, Math.round((b.val / maxVal) * 100));
      return { ...b, h };
    });
  };

  const dynamicRevenueBars = getDynamicRevenueBars();

  // Build active fleet array from trips and vehicles data
  const buildFleet = (allTrips: any[], allVehicles: any[]) => {
    const activeTrips = allTrips.filter(
      (t) => t.status === 'BOARDING' || t.status === 'IN_TRANSIT' || t.status === 'SCHEDULED'
    );

    const activeBuses: ActiveBus[] = activeTrips.map((trip) => {
      const v = trip.vehicleId;
      const d = trip.driverId;
      const r = trip.routeId;

      const vehicleIdStr = typeof v === 'object' && v !== null ? v._id || v.id : v;
      const vehicleDetail = allVehicles.find((vh) => vh._id === vehicleIdStr || vh.id === vehicleIdStr);
      const liveLoc = vehicleDetail?.locations?.[0];

      const routeName = typeof r === 'object' && r !== null ? r.name : 'Unassigned Route';
      const routePath = typeof r === 'object' && r !== null ? r.path : null;
      const driverName = typeof d === 'object' && d !== null ? d.name : 'Unassigned Driver';

      let lat = 30.0444;
      let lng = 31.2357;

      if (liveLoc && liveLoc.location?.coordinates) {
        lat = liveLoc.location.coordinates[1];
        lng = liveLoc.location.coordinates[0];
      } else if (routePath?.coordinates && routePath.coordinates.length > 0) {
        lng = routePath.coordinates[0][0];
        lat = routePath.coordinates[0][1];
      }

      const vehiclePlate = typeof v === 'object' && v !== null
        ? v.licensePlate || v.plateNumber || 'N/A'
        : vehicleDetail?.licensePlate || vehicleDetail?.plateNumber || 'N/A';

      const vehicleMake = typeof v === 'object' && v !== null
        ? v.make || 'D-Ride'
        : vehicleDetail?.make || 'D-Ride';

      const vehicleModel = typeof v === 'object' && v !== null
        ? v.model || 'Shuttle'
        : vehicleDetail?.model || 'Shuttle';

      return {
        id: trip._id,
        vehicleId: vehicleIdStr || '',
        plate: vehiclePlate,
        make: vehicleMake,
        model: vehicleModel,
        route: routeName,
        driver: driverName,
        driverId: typeof d === 'object' && d !== null ? d._id || d.id : d || '',
        lat,
        lng,
        seats: `${trip.bookedSeats} / ${trip.availableSeats}`,
        speed: liveLoc?.speedKmh || (trip.status === 'IN_TRANSIT' ? 50 : 0),
        status: trip.status,
      };
    });

    return activeBuses;
  };

  // Fetch trips and vehicles data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [tripsData, vehiclesData] = await Promise.all([
          tripsAPI.getAll(),
          vehiclesAPI.getAll()
        ]);
        setAllTrips(tripsData);
        setAllVehicles(vehiclesData);
        const builtFleet = buildFleet(tripsData, vehiclesData);
        setFleet(builtFleet);
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      }
    };

    fetchDashboardData();
    const pollInterval = setInterval(fetchDashboardData, 10000);

    return () => clearInterval(pollInterval);
  }, []);

  // WebSockets live vehicle location tracking updates
  useEffect(() => {
    if (fleet.length === 0) return;

    const token = localStorage.getItem('dride_token');
    const socket = io(SOCKET_URL, {
      path: '/api/socket.io',
      transports: ['polling', 'websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      console.log('Dashboard connected to WebSocket server');
      fleet.forEach((bus) => {
        if (bus.vehicleId) {
          socket.emit('subscribeToVehicle', bus.vehicleId);
        }
      });
    });

    socket.on('vehicleLocationUpdate', (data: any) => {
      if (data && data.vehicleId && data.location) {
        setFleet((prevFleet) =>
          prevFleet.map((bus) => {
            if (bus.vehicleId === data.vehicleId) {
              return {
                ...bus,
                lat: data.location.latitude,
                lng: data.location.longitude,
                speed: data.speedKmh || 45,
              };
            }
            return bus;
          })
        );
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [fleet.map(b => b.vehicleId).join(',')]);

  // Fetch OSRM route curves for selected vehicle route
  useEffect(() => {
    if (!selectedBusId) {
      setSelectedRoutePath([]);
      return;
    }

    const fetchRoute = async () => {
      try {
        // Fetch full trip details on-demand since coordinates are excluded in the list payload
        const fullTrip = await tripsAPI.getById(selectedBusId);
        const points = fullTrip?.routeId?.path?.coordinates?.map(
          (c: number[]) => [c[1], c[0]] as [number, number]
        ) || [];

        if (!points || points.length < 2) {
          setSelectedRoutePath([]);
          return;
        }

        const coordsString = points
          .map((p: [number, number]) => `${p[1]},${p[0]}`) // Lng, Lat
          .join(';');
        
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          const coords = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
          setSelectedRoutePath(coords);
        } else {
          setSelectedRoutePath(points);
        }
      } catch (err) {
        console.warn("OSRM routing failed on dashboard, falling back:", err);
        setSelectedRoutePath([]);
      }
    };
    fetchRoute();
  }, [selectedBusId]);

  const toggleSimulation = async (bus: ActiveBus) => {
    if (simulatingBusId === bus.id) {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
      setSimulatingBusId(null);
    } else {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
      }
      setSimulatingBusId(bus.id);

      let coords: [number, number][] = [];
      try {
        const fullTrip = await tripsAPI.getById(bus.id);
        coords = fullTrip?.routeId?.path?.coordinates?.map(
          (c: number[]) => [c[1], c[0]] as [number, number]
        ) || [];
      } catch (err) {
        console.error('Failed to load trip coordinates for simulation', err);
      }

      if (coords.length === 0) {
        setSimulatingBusId(null);
        return;
      }

      let index = 0;
      simIntervalRef.current = setInterval(async () => {
        if (index >= coords.length) {
          index = 0;
        }
        const [lat, lng] = coords[index];
        try {
          await vehiclesAPI.updateLocation(
            bus.vehicleId || 'mock-vehicle-id',
            bus.driverId || 'mock-driver-id',
            lat,
            lng
          );
        } catch (e) {
          console.error('Failed live dashboard simulation location push', e);
        }
        index++;
      }, 3000);
    }
  };

  return (
    <>
      {(() => {
        const todayStr = new Date().toDateString();
        const tripsTodayCount = allTrips.filter(t => t.departureTime && new Date(t.departureTime).toDateString() === todayStr).length || allTrips.length;
        const activeVehiclesCount = allVehicles.filter(v => v.isActive).length || allVehicles.length;
        const revenueTodayVal = bookings
          .filter(b => b.status === 'CONFIRMED' || b.status === 'COMPLETED' || b.paymentStatus === 'SUCCESS')
          .filter(b => b.createdAt && new Date(b.createdAt).toDateString() === todayStr)
          .reduce((sum, b) => sum + (b.amountEGP || 0), 0)
          || bookings.filter(b => b.status === 'CONFIRMED' || b.status === 'COMPLETED' || b.paymentStatus === 'SUCCESS').reduce((sum, b) => sum + (b.amountEGP || 0), 0);
        const activePassengersCount = passengersCount || 12;

        return (
          <>
            <div className="dashboard-welcome">
              <h1>Good evening, Admin 👋</h1>
              <p>Here's what's happening with D-Ride today.</p>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid" style={{ marginBottom: '2rem' }}>
              <div className="kpi-card amber">
                <div className="kpi-header">
                  <div className="kpi-icon amber" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bus size={20} /></div>
                  <span className="kpi-trend up">↑ 12%</span>
                </div>
                <div className="kpi-value">{tripsTodayCount}</div>
                <div className="kpi-label">Total Trips Today</div>
              </div>

              <div className="kpi-card green">
                <div className="kpi-header">
                  <div className="kpi-icon green" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CarFront size={20} /></div>
                  <span className="kpi-trend up">↑ 4%</span>
                </div>
                <div className="kpi-value">{activeVehiclesCount}</div>
                <div className="kpi-label">Active Vehicles</div>
              </div>

              <div className="kpi-card blue">
                <div className="kpi-header">
                  <div className="kpi-icon blue" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Banknote size={20} /></div>
                  <span className="kpi-trend up">↑ 18%</span>
                </div>
                <div className="kpi-value">EGP {revenueTodayVal.toLocaleString()}</div>
                <div className="kpi-label">Revenue Today</div>
              </div>

              <div className="kpi-card red">
                <div className="kpi-header">
                  <div className="kpi-icon red" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={20} /></div>
                  <span className="kpi-trend down">↓ 2%</span>
                </div>
                <div className="kpi-value">{activePassengersCount}</div>
                <div className="kpi-label">Active Passengers</div>
              </div>
            </div>
          </>
        );
      })()}

      {/* Live Fleet Tracking Map Hub */}
      <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: 'var(--radius-xl)' }}>
        <div className="card-header" style={{ marginBottom: '1rem', borderBottom: 'none' }}>
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={20} /> Live Fleet Control Center
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Real-time telemetry and GPS coordinates of active passenger shuttles driving in Cairo
            </p>
          </div>
          <span className="status-badge confirmed" style={{ animation: 'pulse 2s infinite' }}>
            ● LIVE TELEMETRY
          </span>
        </div>

        <div className="fleet-map-grid" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', height: '420px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', zIndex: 1 }}>
          
          {/* Shuttles Sidebar */}
          <div style={{ background: 'var(--surface-elevated)', overflowY: 'auto', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              ONLINE SHUTTLES ({fleet.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {fleet.map((bus) => {
                const isSelected = selectedBusId === bus.id;
                return (
                  <div 
                    key={bus.id}
                    onClick={() => {
                      setSelectedBusId(bus.id);
                      setMapPanTo([bus.lat, bus.lng]);
                    }}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(245, 183, 49, 0.08)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                      transition: 'all 0.2s',
                      textAlign: 'left'
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-hover)'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>🚐 {bus.plate}</strong>
                      <span style={{ fontSize: '10.5px', color: bus.speed > 0 ? 'var(--success)' : 'var(--text-muted)', fontWeight: 'bold' }}>
                        {bus.speed > 0 ? `${bus.speed} km/h` : 'Stopped'}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {bus.route}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {bus.driver.split(' ').slice(1).join(' ')} · {bus.seats}
                    </div>
                    {isSelected && (
                      <div style={{ marginTop: '8px' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSimulation(bus);
                          }}
                          style={{
                            background: simulatingBusId === bus.id ? '#ef4444' : 'var(--primary-color, #F5B731)',
                            color: simulatingBusId === bus.id ? 'white' : 'black',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '9.5px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                          }}
                        >
                          {simulatingBusId === bus.id ? '⏹ Stop Simulation' : '▶ Simulate Drive'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Map Container */}
          <div style={{ position: 'relative', height: '100%' }}>
            {/* View Mode Toggle Controls Overlay */}
            <div style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              zIndex: 1000,
              display: 'flex',
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '2px',
              boxShadow: 'var(--shadow-md)',
            }}>
              <button
                type="button"
                onClick={() => setMapViewMode('FLEET')}
                style={{
                  background: mapViewMode === 'FLEET' ? 'var(--primary-color)' : 'transparent',
                  color: mapViewMode === 'FLEET' ? 'black' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Activity size={12} />
                Fleet Track
              </button>
              <button
                type="button"
                onClick={() => setMapViewMode('HEATMAP')}
                style={{
                  background: mapViewMode === 'HEATMAP' ? 'var(--primary-color)' : 'transparent',
                  color: mapViewMode === 'HEATMAP' ? 'black' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Flame size={12} />
                Demand Heatmap
              </button>
            </div>

            <div ref={mapContainerRef} style={{ height: '100%', width: '100%', zIndex: 1 }} />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Bookings SVG Line Chart */}
        <div className="card" style={{ padding: '1.25rem 1.5rem', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Commute Bookings Trend</h3>
              <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600 }}>{dynamicBookings.growth}</span>
            </div>
            
            {/* Range Toggle buttons */}
            <div style={{ display: 'flex', background: 'var(--surface-elevated)', borderRadius: '6px', border: '1px solid var(--border)', padding: '2px' }}>
              {(['daily', 'weekly', 'monthly'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => {
                    setBookingsRange(range);
                    setHoveredBookingPoint(null);
                  }}
                  style={{
                    background: bookingsRange === range ? 'var(--primary-color)' : 'transparent',
                    color: bookingsRange === range ? '#000' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    transition: 'all 0.2s'
                  }}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div style={{ position: 'relative', width: '100%', height: '160px' }}>
            <svg viewBox="0 0 500 150" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line x1="0" y1="20" x2="500" y2="20" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="5 5" />
              <line x1="0" y1="70" x2="500" y2="70" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="5 5" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="5 5" />
              
              {/* Area path */}
              <path 
                d={dynamicBookings.areaPath} 
                fill="url(#lineGrad)" 
                style={{ transition: 'd 0.5s ease-in-out' }} 
              />
              {/* Line path */}
              <path 
                d={dynamicBookings.linePath} 
                fill="none" 
                stroke="var(--primary)" 
                strokeWidth="3" 
                style={{ transition: 'd 0.5s ease-in-out' }}
              />
              
              {/* Data points */}
              {dynamicBookings.points.map((pt: any, i: number) => {
                const isHovered = hoveredBookingPoint?.index === i;
                return (
                  <g key={i}>
                    {/* Invisible larger hover trigger area */}
                    <circle
                      cx={pt.x || 0}
                      cy={pt.y || 0}
                      r="12"
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredBookingPoint({ ...pt, index: i })}
                      onMouseLeave={() => setHoveredBookingPoint(null)}
                    />
                    <circle 
                      cx={pt.x || 0} 
                      cy={pt.y || 0} 
                      r={isHovered ? 6 : 4} 
                      fill={isHovered ? 'var(--primary)' : '#000'} 
                      stroke="var(--primary)" 
                      strokeWidth={isHovered ? 3 : 2} 
                      style={{ transition: 'all 0.15s ease', pointerEvents: 'none' }}
                    />
                  </g>
                );
              })}
              
              {/* Labels */}
              {dynamicBookings.points.map((pt: any, i: number) => (
                <text key={i} x={pt.x} y="145" fill="var(--text-muted)" fontSize="9" textAnchor="middle">{pt.label}</text>
              ))}
            </svg>

            {/* Hover Tooltip */}
            {hoveredBookingPoint && (
              <div style={{
                position: 'absolute',
                left: `${(hoveredBookingPoint.x / 500) * 100}%`,
                top: `${(hoveredBookingPoint.y / 150) * 100 - 35}%`,
                transform: 'translate(-50%, -100%)',
                background: 'rgba(14, 14, 27, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid var(--primary)',
                borderRadius: '6px',
                padding: '6px 10px',
                pointerEvents: 'none',
                boxShadow: '0 4px 15px rgba(245,183,49,0.25)',
                zIndex: 10,
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                minWidth: '90px'
              }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  {hoveredBookingPoint.label}
                </span>
                <span style={{ fontSize: '12px', color: '#fff', fontWeight: 800 }}>
                  {hoveredBookingPoint.count} trips
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Revenue SVG Bar Chart */}
        <div className="card" style={{ padding: '1.25rem 1.5rem', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Daily Checkout Revenue</h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target: EGP 50,000</span>
            </div>
            
            {/* Region selection filter */}
            <select
              value={revenueRegion}
              onChange={(e) => {
                setRevenueRegion(e.target.value as any);
                setHoveredBarIndex(null);
              }}
              style={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '11px',
                fontWeight: 'bold',
                padding: '4px 8px',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="ALL">All Regions</option>
              <option value="CAIRO">Greater Cairo</option>
              <option value="GIZA">Giza</option>
              <option value="ALEX">Alexandria</option>
            </select>
          </div>

          <div style={{ position: 'relative', width: '100%', height: '160px' }}>
            <svg viewBox="0 0 500 150" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              {/* Horizontal helper grid lines */}
              <line x1="0" y1="20" x2="500" y2="20" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="5 5" />
              <line x1="0" y1="70" x2="500" y2="70" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="5 5" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="5 5" />

              {dynamicRevenueBars.map((bar, i) => {
                const isRegionMatch = revenueRegion === 'ALL' || bar.region === revenueRegion;
                const isHovered = hoveredBarIndex === i;
                const barOpacity = isHovered ? 1.0 : (isRegionMatch ? 0.85 : 0.15);
                const scaleVal = isHovered ? 1.05 : 1.0;
                
                return (
                  <g key={i}>
                    <rect
                      x={bar.x}
                      y={130 - bar.h}
                      width={bar.w}
                      height={bar.h}
                      fill={bar.color}
                      rx="4"
                      opacity={barOpacity}
                      style={{
                        cursor: isRegionMatch ? 'pointer' : 'default',
                        transform: `scaleY(${scaleVal})`,
                        transformOrigin: `${bar.x + bar.w / 2}px 130px`,
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                      onMouseEnter={() => {
                        if (isRegionMatch) setHoveredBarIndex(i);
                      }}
                      onMouseLeave={() => setHoveredBarIndex(null)}
                    />
                    <text x={bar.x + bar.w / 2} y="145" fill="var(--text-muted)" fontSize="9" textAnchor="middle">{bar.city}</text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip */}
            {hoveredBarIndex !== null && (
              <div style={{
                position: 'absolute',
                left: `${((dynamicRevenueBars[hoveredBarIndex].x + dynamicRevenueBars[hoveredBarIndex].w / 2) / 500) * 100}%`,
                top: `${((130 - dynamicRevenueBars[hoveredBarIndex].h) / 150) * 100 - 15}%`,
                transform: 'translate(-50%, -100%)',
                background: 'rgba(14, 14, 27, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid var(--primary)',
                borderRadius: '6px',
                padding: '6px 10px',
                pointerEvents: 'none',
                boxShadow: '0 4px 15px rgba(245,183,49,0.25)',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1px'
              }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>{dynamicRevenueBars[hoveredBarIndex].city}</span>
                <span style={{ fontSize: '11px', color: '#fff', fontWeight: 800 }}>EGP {dynamicRevenueBars[hoveredBarIndex].val.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Fleet Capacity Utilization Donut Chart */}
        <div 
          className="card" 
          style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Fleet Seat Occupancy</h3>
            <span className="status-badge confirmed" style={{ padding: '2px 8px', fontSize: '9px' }}>Optimal</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', height: '160px', gap: '8px' }}>
            <div style={{ position: 'relative', width: '100px', height: '100px' }}>
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%' }}>
                {/* Free Segment */}
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={hoveredDonutSector === 'free' ? 'rgba(255,255,255,0.2)' : 'var(--border)'}
                  strokeWidth={hoveredDonutSector === 'free' ? '5' : '3.5'}
                  style={{ transition: 'all 0.2s', cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredDonutSector('free')}
                  onMouseLeave={() => setHoveredDonutSector(null)}
                />
                {/* Booked Segment */}
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth={hoveredDonutSector === 'booked' ? '5' : '3.5'}
                  strokeDasharray={`${occupancyStats.bookedPercentage}, 100`}
                  style={{ transition: 'all 0.2s', cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredDonutSector('booked')}
                  onMouseLeave={() => setHoveredDonutSector(null)}
                />
              </svg>
              
              {/* Dynamic Center Text based on hovered segment */}
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', width: '80%' }}>
                {hoveredDonutSector === 'free' ? (
                  <>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-secondary)' }}>{occupancyStats.freePercentage}%</div>
                    <div style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Free</div>
                  </>
                ) : hoveredDonutSector === 'average' ? (
                  <>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--success)' }}>{occupancyStats.avgLoad}%</div>
                    <div style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg Load</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{occupancyStats.bookedPercentage}%</div>
                    <div style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {hoveredDonutSector === 'booked' ? 'Booked' : 'Utilized'}
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', opacity: hoveredDonutSector === 'booked' ? 1.0 : 0.8 }}
                onMouseEnter={() => setHoveredDonutSector('booked')}
                onMouseLeave={() => setHoveredDonutSector(null)}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></span>
                <span style={{ fontWeight: hoveredDonutSector === 'booked' ? 'bold' : 'normal' }}>
                  <strong>{occupancyStats.totalBooked}</strong> Seats Booked
                </span>
              </div>
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', opacity: hoveredDonutSector === 'free' ? 1.0 : 0.8 }}
                onMouseEnter={() => setHoveredDonutSector('free')}
                onMouseLeave={() => setHoveredDonutSector(null)}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--border)' }}></span>
                <span style={{ fontWeight: hoveredDonutSector === 'free' ? 'bold' : 'normal' }}>
                  <strong>{occupancyStats.freeSeats}</strong> Seats Free
                </span>
              </div>
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', opacity: hoveredDonutSector === 'average' ? 1.0 : 0.8 }}
                onMouseEnter={() => setHoveredDonutSector('average')}
                onMouseLeave={() => setHoveredDonutSector(null)}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></span>
                <span style={{ fontWeight: hoveredDonutSector === 'average' ? 'bold' : 'normal' }}>
                  <strong>{occupancyStats.avgLoad}%</strong> Avg Load
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Recent Bookings Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Bookings</h3>
            <span 
              className="card-action" 
              onClick={() => navigate('/bookings')} 
              style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              View All →
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Passenger</th>
                <th>Route</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No recent bookings found
                  </td>
                </tr>
              ) : (
                recentBookings.map((b: any) => {
                  const name = b.userId?.name || 'Unknown User';
                  const email = b.userId?.email || 'N/A';
                  const routeName = b.tripId?.routeId?.name || 'N/A';
                  const amount = b.amountEGP || 0;
                  const status = b.status || 'PENDING';
                  const initials = getInitials(name);
                  
                  let statusClass = 'pending';
                  if (status === 'CONFIRMED' || status === 'SUCCESS') statusClass = 'confirmed';
                  if (status === 'CANCELLED') statusClass = 'cancelled';

                  return (
                    <tr key={b._id}>
                      <td>
                        <div className="table-user">
                          <div className="table-avatar" style={{ 
                            background: status === 'CANCELLED' 
                              ? 'rgba(239,68,68,0.15)' 
                              : status === 'PENDING' 
                                ? 'rgba(245,183,49,0.15)' 
                                : 'rgba(59,130,246,0.15)', 
                            color: status === 'CANCELLED' 
                              ? '#EF4444' 
                              : status === 'PENDING' 
                                ? '#F5B731' 
                                : '#3B82F6' 
                          }}>
                            {initials}
                          </div>
                          <div>
                            <div className="table-user-name">{name}</div>
                            <div className="table-user-email">{email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{routeName}</td>
                      <td style={{ fontWeight: 600 }}>EGP {amount}</td>
                      <td><span className={`status-badge ${statusClass}`}>{status}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{formatTimeAgo(b.createdAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Activity Feed */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Activity</h3>
            <span 
              className="card-action" 
              onClick={() => navigate('/crm')} 
              style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              See All
            </span>
          </div>
          <div className="card-body">
            <div className="activity-list">
              {recentActivities.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No recent activity recorded
                </div>
              ) : (
                recentActivities.map((act: any) => (
                  <div className="activity-item" key={act.id}>
                    <div className="activity-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {act.icon}
                    </div>
                    <div>
                      <div className="activity-text">
                        {act.text}
                      </div>
                      <div className="activity-time">{formatTimeAgo(act.date.toISOString())}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
