import { useEffect, useState } from 'react';
import { Table, Tag, Row, Col, Card, Statistic, Select, Space, Button, Input, Progress } from 'antd';
import { bookingsAPI, routesAPI, tripsAPI } from '../services/api';
import { TrendingUp, DollarSign, Ticket, Activity, Download, BarChart2, Percent, Navigation } from 'lucide-react';
import { exportToCSV } from '../utils/csv';

interface RouteProfitRow {
  key: string;
  routeId: string;
  routeName: string;
  distanceKm: number;
  tripsCount: number;
  seatsSold: number;
  occupancyRate: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

export function AnalyticsPage() {
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  
  // Interactive Filters
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('ALL');
  
  // Search bar for routes profitability table
  const [tableSearch, setTableSearch] = useState('');

  // Hover states for interactive SVG charts
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [routesData, bookingsData, tripsData] = await Promise.all([
        routesAPI.getAll(),
        bookingsAPI.getAll(),
        tripsAPI.getAll()
      ]);
      setRoutes(routesData);
      setBookings(bookingsData);
      setTrips(tripsData);
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter helper: check if booking matches date filter
  const isBookingInDateRange = (bookingDateStr: string, filter: string) => {
    if (filter === 'ALL') return true;
    const now = new Date();
    const created = new Date(bookingDateStr);
    const diffMs = now.getTime() - created.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (filter === 'DAILY') return diffDays <= 1;
    if (filter === 'WEEKLY') return diffDays <= 7;
    if (filter === 'MONTHLY') return diffDays <= 30;
    return true;
  };

  // Filter Bookings & Trips based on controls
  const filteredBookings = bookings.filter(b => {
    const matchesRoute = selectedRouteId === 'ALL' || b.tripId?.routeId?._id === selectedRouteId || b.tripId?.routeId === selectedRouteId;
    const matchesDate = b.createdAt && isBookingInDateRange(b.createdAt, dateFilter);
    const isSuccess = b.status === 'CONFIRMED' || b.status === 'COMPLETED' || b.paymentStatus === 'SUCCESS';
    return isSuccess && matchesRoute && matchesDate;
  });

  const filteredTrips = trips.filter(t => {
    const matchesRoute = selectedRouteId === 'ALL' || t.routeId?._id === selectedRouteId || t.routeId === selectedRouteId;
    const matchesDate = t.departureTime && isBookingInDateRange(t.departureTime, dateFilter);
    const isActive = t.status !== 'CANCELLED';
    return isActive && matchesRoute && matchesDate;
  });

  // Calculate gross KPIs
  const totalRevenue = filteredBookings.reduce((sum, b) => sum + (b.amountEGP || 0), 0);
  const totalBookingsCount = filteredBookings.length;
  const averageTicket = totalBookingsCount > 0 ? Math.round(totalRevenue / totalBookingsCount) : 0;

  // Cost and Profit calculations:
  // Base Operating Cost per trip = distanceKm * 4.5 EGP (fuel / maintenance) + 150 EGP (driver rate)
  const calculateTripCost = (t: any) => {
    const distance = t.routeId?.distanceKm || 25;
    return Math.round(distance * 4.5 + 150);
  };

  const totalOperatingCost = filteredTrips
    .filter(t => t.status === 'COMPLETED' || t.status === 'IN_TRANSIT')
    .reduce((sum, t) => sum + calculateTripCost(t), 0);

  const netProfit = totalRevenue - totalOperatingCost;
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

  // Generate Route Profitability Table rows
  const routeProfitsTableData: RouteProfitRow[] = routes.map(route => {
    const routeId = route._id;
    const routeName = route.name;
    const distanceKm = route.distanceKm || 30;

    // Filter bookings for this route
    const rBookings = bookings.filter(b => {
      const isSuccess = b.status === 'CONFIRMED' || b.status === 'COMPLETED' || b.paymentStatus === 'SUCCESS';
      const matchesRoute = b.tripId?.routeId?._id === routeId || b.tripId?.routeId === routeId;
      const matchesDate = b.createdAt && isBookingInDateRange(b.createdAt, dateFilter);
      return isSuccess && matchesRoute && matchesDate;
    });

    const rTrips = trips.filter(t => {
      const isActive = t.status !== 'CANCELLED';
      const matchesRoute = t.routeId?._id === routeId || t.routeId === routeId;
      const matchesDate = t.departureTime && isBookingInDateRange(t.departureTime, dateFilter);
      return isActive && matchesRoute && matchesDate;
    });

    const runTrips = rTrips.filter(t => t.status === 'COMPLETED' || t.status === 'IN_TRANSIT');

    // Stats
    const seatsSold = rBookings.reduce((sum, b) => sum + (b.seatNumbers?.length || 1), 0);
    const capacity = rTrips.reduce((sum, t) => sum + (t.availableSeats || 14), 0);
    const occupancyRate = capacity > 0 ? Math.round((seatsSold / capacity) * 100) : 0;

    const revenue = rBookings.reduce((sum, b) => sum + (b.amountEGP || 0), 0);
    const cost = runTrips.reduce((sum, t) => sum + calculateTripCost(t), 0);
    const profit = revenue - cost;
    const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

    return {
      key: routeId,
      routeId,
      routeName,
      distanceKm,
      tripsCount: rTrips.length,
      seatsSold,
      occupancyRate,
      revenue,
      cost,
      profit,
      margin
    };
  });

  // Filter Table Data based on Search
  const filteredTableData = routeProfitsTableData.filter(row => 
    row.routeName.toLowerCase().includes(tableSearch.toLowerCase())
  );

  // Generate 7-day Weekly Trend Data for line chart
  const getWeeklyTrend = () => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dayLabel = d.toLocaleDateString([], { weekday: 'short' });
      
      const dayBookings = bookings.filter(b => {
        const isSuccess = b.status === 'CONFIRMED' || b.status === 'COMPLETED' || b.paymentStatus === 'SUCCESS';
        const matchesRoute = selectedRouteId === 'ALL' || b.tripId?.routeId?._id === selectedRouteId || b.tripId?.routeId === selectedRouteId;
        const pDate = new Date(b.createdAt);
        return isSuccess && matchesRoute && pDate.toDateString() === d.toDateString();
      });

      const dayTrips = trips.filter(t => {
        const isActive = t.status === 'COMPLETED' || t.status === 'IN_TRANSIT';
        const matchesRoute = selectedRouteId === 'ALL' || t.routeId?._id === selectedRouteId || t.routeId === selectedRouteId;
        const pDate = new Date(t.departureTime);
        return isActive && matchesRoute && pDate.toDateString() === d.toDateString();
      });

      const revenue = dayBookings.reduce((sum, b) => sum + (b.amountEGP || 0), 0);
      const cost = dayTrips.reduce((sum, t) => sum + calculateTripCost(t), 0);
      const profit = revenue - cost;

      days.push({ label: dayLabel, revenue, profit });
    }
    return days;
  };

  const trendData = getWeeklyTrend();
  const allTrendValues = trendData.flatMap(t => [t.revenue, t.profit]);
  const maxTrendVal = Math.max(...allTrendValues, 100);
  const minTrendVal = Math.min(...allTrendValues, 0);
  const trendValRange = maxTrendVal - minTrendVal;

  // SVG drawing details
  const svgWidth = 500;
  const svgHeight = 160;
  const getSvgCoordinates = (values: number[]) => {
    return values.map((val, idx) => {
      const x = (idx / (values.length - 1)) * (svgWidth - 60) + 30;
      const ratio = trendValRange > 0 ? (val - minTrendVal) / trendValRange : 0.5;
      const y = svgHeight - ratio * (svgHeight - 40) - 20;
      return `${x},${y}`;
    }).join(' ');
  };

  const revenuePoints = getSvgCoordinates(trendData.map(t => t.revenue));
  const profitPoints = getSvgCoordinates(trendData.map(t => t.profit));
  
  // Calculate dynamic zero baseline Y coordinate
  const zeroRatio = trendValRange > 0 ? (0 - minTrendVal) / trendValRange : 0.5;
  const yZero = svgHeight - zeroRatio * (svgHeight - 40) - 20;

  // Payment Breakdown for Donut Chart
  const getPaymentBreakdown = () => {
    let cardCount = 0;
    let walletCount = 0;

    filteredBookings.forEach(b => {
      const isCard = b.paymobOrderId != null;
      // Mock wallet split if phone matches typical pattern or standard distribution
      const isWallet = !isCard && b.userId?.phone && b.userId.phone.startsWith('+201');
      if (isCard) cardCount += b.amountEGP || 0;
      else if (isWallet) walletCount += b.amountEGP || 0;
    });

    const total = cardCount + walletCount || 1;
    return [
      { name: 'Credit Card (Paymob)', value: cardCount, percentage: Math.round((cardCount / total) * 100), color: '#3b82f6' },
      { name: 'Mobile Wallet', value: walletCount, percentage: Math.round((walletCount / total) * 100), color: '#10b981' }
    ];
  };

  const paymentBreakdown = getPaymentBreakdown();

  const handleExport = () => {
    const headers = [
      { key: 'routeName', label: 'Route Name' },
      { key: 'distanceKm', label: 'Distance (KM)' },
      { key: 'tripsCount', label: 'Trips Run' },
      { key: 'seatsSold', label: 'Seats Sold' },
      { key: 'occupancyRate', label: 'Occupancy Rate (%)', transform: (val: any) => `${val}%` },
      { key: 'revenue', label: 'Revenue (EGP)' },
      { key: 'cost', label: 'Est. Operating Cost (EGP)' },
      { key: 'profit', label: 'Net Profit (EGP)' },
      { key: 'margin', label: 'Profit Margin (%)', transform: (val: any) => `${val}%` }
    ];
    exportToCSV(filteredTableData, headers, `route_profitability_report_${dateFilter}`);
  };

  // Ant Design Table Columns with full sorting configs
  const columns = [
    {
      title: 'Route Connection',
      dataIndex: 'routeName',
      key: 'routeName',
      sorter: (a: RouteProfitRow, b: RouteProfitRow) => a.routeName.localeCompare(b.routeName),
      render: (name: string) => <strong>{name}</strong>
    },
    {
      title: 'Distance',
      dataIndex: 'distanceKm',
      key: 'distanceKm',
      sorter: (a: RouteProfitRow, b: RouteProfitRow) => a.distanceKm - b.distanceKm,
      render: (km: number) => `${km} km`
    },
    {
      title: 'Trips Run',
      dataIndex: 'tripsCount',
      key: 'tripsCount',
      sorter: (a: RouteProfitRow, b: RouteProfitRow) => a.tripsCount - b.tripsCount,
      render: (count: number) => <Tag color="blue">{count} Trips</Tag>
    },
    {
      title: 'Occupancy',
      dataIndex: 'occupancyRate',
      key: 'occupancyRate',
      sorter: (a: RouteProfitRow, b: RouteProfitRow) => a.occupancyRate - b.occupancyRate,
      render: (rate: number) => (
        <Space direction="vertical" style={{ width: '100%' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{rate}%</span>
          <Progress percent={rate} size="small" showInfo={false} status={rate > 75 ? 'success' : rate > 40 ? 'normal' : 'exception'} />
        </Space>
      )
    },
    {
      title: 'Gross Revenue',
      dataIndex: 'revenue',
      key: 'revenue',
      sorter: (a: RouteProfitRow, b: RouteProfitRow) => a.revenue - b.revenue,
      render: (val: number) => <strong style={{ color: 'var(--text-primary)' }}>{val.toLocaleString()} EGP</strong>
    },
    {
      title: 'Est. Operating Cost',
      dataIndex: 'cost',
      key: 'cost',
      sorter: (a: RouteProfitRow, b: RouteProfitRow) => a.cost - b.cost,
      render: (val: number) => <span style={{ color: 'var(--text-muted)' }}>{val.toLocaleString()} EGP</span>
    },
    {
      title: 'Net Profit',
      dataIndex: 'profit',
      key: 'profit',
      sorter: (a: RouteProfitRow, b: RouteProfitRow) => a.profit - b.profit,
      render: (val: number) => {
        const isLoss = val < 0;
        return (
          <Tag color={isLoss ? 'red' : 'green'} style={{ fontSize: '13px', fontWeight: 'bold', padding: '2px 8px' }}>
            {isLoss ? '' : '+'}{val.toLocaleString()} EGP
          </Tag>
        );
      }
    },
    {
      title: 'Profit Margin',
      dataIndex: 'margin',
      key: 'margin',
      sorter: (a: RouteProfitRow, b: RouteProfitRow) => a.margin - b.margin,
      render: (val: number) => {
        const isLoss = val < 0;
        return (
          <span style={{ fontWeight: 'bold', color: isLoss ? '#ff4d4f' : '#52c41a', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Percent size={14} /> {val}%
          </span>
        );
      }
    }
  ];

  return (
    <div style={{ padding: '2rem 0' }}>
      {/* Page Header with Controls */}
      <div className="dashboard-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }} className="title-outfit">
            <BarChart2 size={32} style={{ color: 'var(--primary-color)' }} /> Analytics & Profits Hub
          </h1>
          <p style={{ margin: '4px 0 0' }}>Monitor route-specific profitability, passenger bookings LTV, and net operating cost margins</p>
        </div>
        <Space wrap>
          <div style={{ display: 'flex', background: 'var(--surface-hover)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <Button type={dateFilter === 'ALL' ? 'primary' : 'text'} size="small" onClick={() => setDateFilter('ALL')} style={{ background: dateFilter === 'ALL' ? 'var(--primary-color)' : 'transparent', color: dateFilter === 'ALL' ? 'black' : 'var(--text-secondary)', fontWeight: 'bold' }}>All Time</Button>
            <Button type={dateFilter === 'MONTHLY' ? 'primary' : 'text'} size="small" onClick={() => setDateFilter('MONTHLY')} style={{ background: dateFilter === 'MONTHLY' ? 'var(--primary-color)' : 'transparent', color: dateFilter === 'MONTHLY' ? 'black' : 'var(--text-secondary)', fontWeight: 'bold' }}>30 Days</Button>
            <Button type={dateFilter === 'WEEKLY' ? 'primary' : 'text'} size="small" onClick={() => setDateFilter('WEEKLY')} style={{ background: dateFilter === 'WEEKLY' ? 'var(--primary-color)' : 'transparent', color: dateFilter === 'WEEKLY' ? 'black' : 'var(--text-secondary)', fontWeight: 'bold' }}>7 Days</Button>
            <Button type={dateFilter === 'DAILY' ? 'primary' : 'text'} size="small" onClick={() => setDateFilter('DAILY')} style={{ background: dateFilter === 'DAILY' ? 'var(--primary-color)' : 'transparent', color: dateFilter === 'DAILY' ? 'black' : 'var(--text-secondary)', fontWeight: 'bold' }}>24 Hours</Button>
          </div>

          <Select
            value={selectedRouteId}
            onChange={setSelectedRouteId}
            style={{ width: 220 }}
            placeholder="Select Route"
          >
            <Select.Option value="ALL">All Connections</Select.Option>
            {routes.map(r => (
              <Select.Option key={r._id} value={r._id}>{r.name}</Select.Option>
            ))}
          </Select>

          <Button onClick={handleExport} icon={<Download size={16} />} style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '36px' }}>
            Export CSV
          </Button>
        </Space>
      </div>

      {/* KPI Cards Grid */}
      <Row gutter={[24, 24]} style={{ marginBottom: '2.5rem' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" className="kpi-card glass amber" style={{ padding: '8px' }}>
            <Statistic 
              title={<span style={{ color: 'var(--text-muted)' }}>Gross Ticket Sales</span>}
              value={totalRevenue}
              suffix=" EGP"
              valueStyle={{ fontWeight: 800, color: 'var(--primary-color)' }}
              prefix={<DollarSign size={20} style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              From {totalBookingsCount} paid bookings (Avg: {averageTicket} EGP)
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" className="kpi-card glass blue" style={{ padding: '8px' }}>
            <Statistic 
              title={<span style={{ color: 'var(--text-muted)' }}>Est. Fleet Cost</span>}
              value={totalOperatingCost}
              suffix=" EGP"
              valueStyle={{ fontWeight: 800, color: '#3b82f6' }}
              prefix={<Navigation size={20} style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Fuel + operators cost model
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" className="kpi-card glass green" style={{ padding: '8px' }}>
            <Statistic 
              title={<span style={{ color: 'var(--text-muted)' }}>Net Commute Profit</span>}
              value={netProfit}
              suffix=" EGP"
              valueStyle={{ fontWeight: 800, color: '#10b981' }}
              prefix={<Activity size={20} style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Fares minus operating costs
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" className="kpi-card glass purple" style={{ padding: '8px' }}>
            <Statistic 
              title={<span style={{ color: 'var(--text-muted)' }}>Profit Margin</span>}
              value={profitMargin}
              suffix=" %"
              valueStyle={{ fontWeight: 800, color: '#a855f7' }}
              prefix={<Percent size={20} style={{ marginRight: '4px', verticalAlign: 'middle' }} />}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Average margin on sold seats
            </div>
          </Card>
        </Col>
      </Row>

      {/* Analytics Charts Grid */}
      <Row gutter={[24, 24]} style={{ marginBottom: '2.5rem' }}>
        {/* Left: Weekly Revenue & Net Profit Line Chart */}
        <Col xs={24} lg={15}>
          <Card variant="borderless" className="glass" style={{ padding: '1rem', borderRadius: '20px' }}>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }} className="title-outfit">
              <TrendingUp size={20} style={{ color: 'var(--primary-color)' }} /> Weekly Financial Trend (EGP)
            </h3>

            <div style={{ position: 'relative', width: '100%', height: '220px' }}>
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3"/>
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0"/>
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1="30" y1="20" x2={svgWidth - 30} y2="20" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="5 5" />
                <line x1="30" y1="65" x2={svgWidth - 30} y2="65" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="5 5" />
                <line x1="30" y1="110" x2={svgWidth - 30} y2="110" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="5 5" />
                
                {/* Zero baseline */}
                <line x1="30" y1={yZero} x2={svgWidth - 30} y2={yZero} stroke="rgba(239, 68, 68, 0.4)" strokeWidth="1.5" strokeDasharray="3 3" />
                <line x1="30" y1="140" x2={svgWidth - 30} y2="140" stroke="var(--border)" strokeWidth="0.5" />

                {/* Revenue Polyline */}
                <polyline points={revenuePoints} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
                {/* Profit Polyline */}
                <polyline points={profitPoints} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />

                {/* Nodes & Interactive trigger circles */}
                {trendData.map((d, i) => {
                  const x = (i / (trendData.length - 1)) * (svgWidth - 60) + 30;
                  const revRatio = trendValRange > 0 ? (d.revenue - minTrendVal) / trendValRange : 0.5;
                  const profRatio = trendValRange > 0 ? (d.profit - minTrendVal) / trendValRange : 0.5;
                  const revY = svgHeight - revRatio * (svgHeight - 40) - 20;
                  const profY = svgHeight - profRatio * (svgHeight - 40) - 20;
                  const isHovered = hoveredTrendIndex === i;

                  return (
                    <g key={i}>
                      {/* Interaction Area */}
                      <rect 
                        x={x - 20} 
                        y={0} 
                        width={40} 
                        height={svgHeight} 
                        fill="transparent" 
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setHoveredTrendIndex(i)}
                        onMouseLeave={() => setHoveredTrendIndex(null)}
                      />
                      
                      {/* Revenue point */}
                      <circle cx={x} cy={revY} r={isHovered ? 6 : 4} fill="#3b82f6" stroke="white" strokeWidth="1.5" />
                      {/* Profit point */}
                      <circle cx={x} cy={profY} r={isHovered ? 6 : 4} fill="#10b981" stroke="white" strokeWidth="1.5" />

                      {/* X-axis Day labels */}
                      <text x={x} y={svgHeight + 12} fill="var(--text-muted)" fontSize="9.5" textAnchor="middle" fontWeight="bold">
                        {d.label}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Tooltip Overlay */}
              {hoveredTrendIndex !== null && (
                <div style={{
                  position: 'absolute',
                  left: `${((hoveredTrendIndex / (trendData.length - 1)) * (svgWidth - 60) + 30) / svgWidth * 100}%`,
                  top: '10px',
                  transform: 'translateX(-50%)',
                  background: 'rgba(14, 14, 27, 0.95)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 100,
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  minWidth: '130px'
                }}>
                  <strong style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{trendData[hoveredTrendIndex].label}</strong>
                  <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 'bold' }}>Revenue: {trendData[hoveredTrendIndex].revenue.toLocaleString()} EGP</span>
                  <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 'bold' }}>Net Profit: {trendData[hoveredTrendIndex].profit.toLocaleString()} EGP</span>
                </div>
              )}
            </div>

            {/* Custom Legend */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '1.25rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <span style={{ width: '10px', height: '4px', background: '#3b82f6', display: 'inline-block', borderRadius: '2px' }} />
                Gross Sales
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <span style={{ width: '10px', height: '4px', background: '#10b981', display: 'inline-block', borderRadius: '2px' }} />
                Net Profit
              </span>
            </div>
          </Card>
        </Col>

        {/* Right: Payment Channels Mix */}
        <Col xs={24} lg={9}>
          <Card variant="borderless" className="glass" style={{ padding: '1rem', borderRadius: '20px', height: '100%' }}>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }} className="title-outfit">
              <Ticket size={20} style={{ color: 'var(--primary-color)' }} /> Checkout Channels Split
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
              {paymentBreakdown.map((item, idx) => (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '6px' }}>
                    <span style={{ color: item.color, fontWeight: 'bold' }}>● {item.name}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{item.percentage}% ({item.value.toLocaleString()} EGP)</span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--surface-hover)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${item.percentage}%`, height: '100%', background: item.color, borderRadius: '4px', transition: 'width 0.5s' }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: '1.75rem',
              padding: '12px 16px',
              background: 'var(--surface-hover)',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              fontSize: '11.5px',
              color: 'var(--text-secondary)',
              lineHeight: 1.4
            }}>
              ℹ️ **Paymob Cards Integration** continues to account for the highest transactional LTV volume across Cairo network lines.
            </div>
          </Card>
        </Col>
      </Row>

      {/* Route Profitability Table Section */}
      <div className="card glass" style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }} className="title-outfit">
            <Percent size={20} style={{ color: 'var(--primary-color)' }} /> Route Profitability Analysis
          </h3>
          <Input.Search 
            placeholder="Filter route connection..."
            value={tableSearch}
            onChange={e => setTableSearch(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
        </div>

        <Table 
          dataSource={filteredTableData} 
          columns={columns} 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </div>
    </div>
  );
}
