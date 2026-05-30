import { useEffect, useState } from 'react';
import { Card, Row, Col, Space, Select, Slider, InputNumber, Table, Tag, Statistic, Button, Typography, Alert, Progress } from 'antd';
import { DollarSign, Calculator, Percent, TrendingUp, Download } from 'lucide-react';
import { routesAPI, tripsAPI } from '../services/api';
import { exportToCSV } from '../utils/csv';

const { Text } = Typography;

export function RouteFinancePage() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);

  // Selected Route
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  
  // Calculator Variables (State adjusted by sliders/numbers)
  const [fuelCostPerKm, setFuelCostPerKm] = useState<number>(4.5);
  const [driverRatePerTrip, setDriverRatePerTrip] = useState<number>(150);
  const [ticketPrice, setTicketPrice] = useState<number>(150);
  const [tripsPerMonth, setTripsPerMonth] = useState<number>(30);
  const [avgSeatsSold, setAvgSeatsSold] = useState<number>(8);

  const fetchData = async () => {
    try {
      const [routesRes, tripsRes] = await Promise.all([
        routesAPI.getAll(),
        tripsAPI.getAll()
      ]);
      setRoutes(routesRes);
      setTrips(tripsRes);
      
      if (routesRes && routesRes.length > 0) {
        setSelectedRouteId(routesRes[0]._id);
      }
    } catch (error) {
      console.error('Failed to load routes data for calculator', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update calculator fields when selected route changes
  const activeRoute = routes.find(r => r._id === selectedRouteId);
  const routeDistance = activeRoute?.distanceKm || 30;

  useEffect(() => {
    if (activeRoute) {
      // Find trips for this route to estimate average ticket price
      const routeTrips = trips.filter(t => t.routeId?._id === selectedRouteId || t.routeId === selectedRouteId);
      if (routeTrips.length > 0 && routeTrips[0].priceEGP) {
        setTicketPrice(routeTrips[0].priceEGP);
      } else {
        setTicketPrice(150); // Fallback
      }
    }
  }, [selectedRouteId, activeRoute]);

  // Calculations
  const costPerTrip = Math.round(routeDistance * fuelCostPerKm + driverRatePerTrip);
  const revenuePerTrip = avgSeatsSold * ticketPrice;
  const profitPerTrip = revenuePerTrip - costPerTrip;
  
  const monthlyRevenue = revenuePerTrip * tripsPerMonth;
  const monthlyExpenses = costPerTrip * tripsPerMonth;
  const monthlyNetProfit = monthlyRevenue - monthlyExpenses;
  const profitMargin = monthlyRevenue > 0 ? Math.round((monthlyNetProfit / monthlyRevenue) * 100) : 0;

  // Break-even seat occupancy count
  const breakEvenSeats = Math.ceil(costPerTrip / ticketPrice);
  const isProfitable = profitPerTrip > 0;

  // Scenario matrix comparing occupancies
  const occupancies = [
    { label: 'Low (25%)', seats: 4, percentage: 25 },
    { label: 'Medium (50%)', seats: 7, percentage: 50 },
    { label: 'Recommended (75%)', seats: 10, percentage: 75 },
    { label: 'Full Capacity (100%)', seats: 14, percentage: 100 }
  ];

  const scenarioTableData = occupancies.map((occ, idx) => {
    const rev = occ.seats * ticketPrice;
    const prof = rev - costPerTrip;
    const margin = rev > 0 ? Math.round((prof / rev) * 100) : 0;

    return {
      key: idx,
      scenario: occ.label,
      seats: occ.seats,
      occupancy: `${occ.percentage}%`,
      revPerTrip: rev,
      costPerTrip: costPerTrip,
      profitPerTrip: prof,
      margin: `${margin}%`,
      monthlyProfit: prof * tripsPerMonth
    };
  });

  const columns = [
    {
      title: 'Occupancy Scenario',
      dataIndex: 'scenario',
      key: 'scenario',
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: 'Seats Sold',
      dataIndex: 'seats',
      key: 'seats',
      render: (seats: number) => <Tag color="purple">{seats} Seats</Tag>
    },
    {
      title: 'Rev. Per Trip',
      dataIndex: 'revPerTrip',
      key: 'revPerTrip',
      render: (val: number) => `${val.toLocaleString()} EGP`
    },
    {
      title: 'Cost Per Trip',
      dataIndex: 'costPerTrip',
      key: 'costPerTrip',
      render: (val: number) => `${val.toLocaleString()} EGP`
    },
    {
      title: 'Profit Per Trip',
      dataIndex: 'profitPerTrip',
      key: 'profitPerTrip',
      render: (val: number) => {
        const isLoss = val < 0;
        return <Tag color={isLoss ? 'red' : 'green'}>{isLoss ? '' : '+'}{val.toLocaleString()} EGP</Tag>;
      }
    },
    {
      title: 'Margin',
      dataIndex: 'margin',
      key: 'margin',
      render: (text: string) => {
        const isLoss = text.startsWith('-');
        return <span style={{ color: isLoss ? '#ff4d4f' : '#52c41a', fontWeight: 'bold' }}>{text}</span>;
      }
    },
    {
      title: 'Monthly Net Profit',
      dataIndex: 'monthlyProfit',
      key: 'monthlyProfit',
      render: (val: number) => {
        const isLoss = val < 0;
        return (
          <strong style={{ color: isLoss ? '#ff4d4f' : '#52c41a', fontSize: '13px' }}>
            {isLoss ? '' : '+'}{val.toLocaleString()} EGP
          </strong>
        );
      }
    }
  ];

  // Dynamic SVG profitability curves plotting
  const svgWidth = 450;
  const svgHeight = 150;
  const maxProfitVal = 14 * ticketPrice - costPerTrip;
  const minProfitVal = 0 - costPerTrip;
  const valRange = maxProfitVal - minProfitVal;

  const getSvgCoordinates = () => {
    const coords = [];
    for (let seats = 0; seats <= 14; seats++) {
      const profit = seats * ticketPrice - costPerTrip;
      const x = (seats / 14) * (svgWidth - 60) + 30;
      // Map profit to height (invert Y because SVG starts at top left)
      const ratio = (profit - minProfitVal) / valRange;
      const y = svgHeight - ratio * (svgHeight - 40) - 20;
      coords.push(`${x},${y}`);
    }
    return coords.join(' ');
  };

  const trendPoints = getSvgCoordinates();

  // Find y-coordinate for the break-even zero line
  const ratioZero = (0 - minProfitVal) / valRange;
  const yZero = svgHeight - ratioZero * (svgHeight - 40) - 20;

  const handleExport = () => {
    const headers = [
      { key: 'scenario', label: 'Occupancy Scenario' },
      { key: 'seats', label: 'Seats Sold' },
      { key: 'occupancy', label: 'Occupancy %' },
      { key: 'revPerTrip', label: 'Revenue Per Trip (EGP)' },
      { key: 'costPerTrip', label: 'Cost Per Trip (EGP)' },
      { key: 'profitPerTrip', label: 'Net Profit Per Trip (EGP)' },
      { key: 'margin', label: 'Profit Margin' },
      { key: 'monthlyProfit', label: 'Projected Monthly Net Profit (EGP)' }
    ];
    exportToCSV(scenarioTableData, headers, `financial_simulation_${activeRoute?.name || 'route'}`);
  };

  return (
    <div style={{ padding: '2rem 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }} className="title-outfit">
            <Calculator size={32} style={{ color: 'var(--primary-color)' }} /> Route Profit & Cost Simulator
          </h1>
          <p style={{ margin: '4px 0 0' }}>Simulate ticket pricing and operating expenses to calculate net route margins and break-even occupancies</p>
        </div>
        <Space wrap>
          <Select
            value={selectedRouteId}
            onChange={setSelectedRouteId}
            style={{ width: 260 }}
            placeholder="Select Route"
          >
            {routes.map(r => (
              <Select.Option key={r._id} value={r._id}>{r.name} ({r.distanceKm} km)</Select.Option>
            ))}
          </Select>
          <Button onClick={handleExport} icon={<Download size={16} />} style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '36px' }}>
            Export Simulation
          </Button>
        </Space>
      </div>

      {activeRoute ? (
        <>
          {/* Statistics grid */}
          <Row gutter={[24, 24]} style={{ marginBottom: '2.5rem' }}>
            <Col xs={24} sm={12} lg={6}>
              <Card variant="borderless" className="kpi-card glass blue" style={{ padding: '8px' }}>
                <Statistic 
                  title={<span style={{ color: 'var(--text-secondary)' }}>Projected Trip Cost</span>}
                  value={costPerTrip}
                  suffix=" EGP"
                  valueStyle={{ fontWeight: 800, color: '#3b82f6' }}
                  prefix={<DollarSign size={20} />}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Fuel: {(routeDistance * fuelCostPerKm).toFixed(0)} EGP | Driver: {driverRatePerTrip} EGP
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card variant="borderless" className="kpi-card glass amber" style={{ padding: '8px' }}>
                <Statistic 
                  title={<span style={{ color: 'var(--text-secondary)' }}>Projected Trip Revenue</span>}
                  value={revenuePerTrip}
                  suffix=" EGP"
                  valueStyle={{ fontWeight: 800, color: 'var(--primary-color)' }}
                  prefix={<DollarSign size={20} />}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Selling {avgSeatsSold} out of 14 microbus seats
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card variant="borderless" className={`kpi-card glass ${isProfitable ? 'green' : 'red'}`} style={{ padding: '8px' }}>
                <Statistic 
                  title={<span style={{ color: 'var(--text-secondary)' }}>Projected Monthly Net Profit</span>}
                  value={monthlyNetProfit}
                  suffix=" EGP"
                  valueStyle={{ fontWeight: 800, color: isProfitable ? '#10b981' : '#ff4d4f' }}
                  prefix={<TrendingUp size={20} />}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Operating Margin: {profitMargin}% ({tripsPerMonth} trips/mo)
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card variant="borderless" className="kpi-card glass purple" style={{ padding: '8px' }}>
                <Statistic 
                  title={<span style={{ color: 'var(--text-secondary)' }}>Break-Even Occupancy</span>}
                  value={breakEvenSeats}
                  suffix=" Seats"
                  valueStyle={{ fontWeight: 800, color: '#8b5cf6' }}
                  prefix={<Percent size={20} />}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {Math.round((breakEvenSeats / 14) * 100)}% bus occupancy required
                </div>
              </Card>
            </Col>
          </Row>

          <Row gutter={[24, 24]}>
            {/* Input Variables Sliders */}
            <Col xs={24} lg={10}>
              <Card title={<strong style={{ color: 'var(--text-primary)' }}>Adjust Variable Expenses & Pricing</strong>} className="refund-card-glass">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Variable 1: Fuel Cost per KM */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <Text strong style={{ color: 'var(--text-primary)' }}>Fuel & Maintenance Rate (EGP/KM)</Text>
                      <InputNumber
                        min={1}
                        max={20}
                        step={0.5}
                        value={fuelCostPerKm}
                        onChange={(val) => setFuelCostPerKm(val || 4.5)}
                        size="small"
                        style={{ width: '80px' }}
                      />
                    </div>
                    <Slider
                      min={1}
                      max={20}
                      step={0.5}
                      value={fuelCostPerKm}
                      onChange={setFuelCostPerKm}
                      tooltip={{ formatter: (val) => `${val} EGP/KM` }}
                    />
                  </div>

                  {/* Variable 2: Driver Fixed Rate */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <Text strong style={{ color: 'var(--text-primary)' }}>Driver fixed fee per trip (EGP)</Text>
                      <InputNumber
                        min={50}
                        max={1000}
                        step={10}
                        value={driverRatePerTrip}
                        onChange={(val) => setDriverRatePerTrip(val || 150)}
                        size="small"
                        style={{ width: '80px' }}
                      />
                    </div>
                    <Slider
                      min={50}
                      max={1000}
                      step={10}
                      value={driverRatePerTrip}
                      onChange={setDriverRatePerTrip}
                      tooltip={{ formatter: (val) => `${val} EGP` }}
                    />
                  </div>

                  {/* Variable 3: Ticket Price */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <Text strong style={{ color: 'var(--text-primary)' }}>Ticket Ticket Price (EGP)</Text>
                      <InputNumber
                        min={30}
                        max={2000}
                        step={5}
                        value={ticketPrice}
                        onChange={(val) => setTicketPrice(val || 150)}
                        size="small"
                        style={{ width: '80px' }}
                      />
                    </div>
                    <Slider
                      min={30}
                      max={2000}
                      step={5}
                      value={ticketPrice}
                      onChange={setTicketPrice}
                      tooltip={{ formatter: (val) => `${val} EGP` }}
                    />
                  </div>

                  {/* Variable 4: Average occupancy sold */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <Text strong style={{ color: 'var(--text-primary)' }}>Seats sold per trip (Occupancy)</Text>
                      <InputNumber
                        min={1}
                        max={14}
                        step={1}
                        value={avgSeatsSold}
                        onChange={(val) => setAvgSeatsSold(val || 8)}
                        size="small"
                        style={{ width: '80px' }}
                      />
                    </div>
                    <Slider
                      min={1}
                      max={14}
                      step={1}
                      value={avgSeatsSold}
                      onChange={setAvgSeatsSold}
                      tooltip={{ formatter: (val) => `${val} seats` }}
                    />
                  </div>

                  {/* Variable 5: Trips frequency per month */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <Text strong style={{ color: 'var(--text-primary)' }}>Trips frequency per month</Text>
                      <InputNumber
                        min={1}
                        max={150}
                        step={1}
                        value={tripsPerMonth}
                        onChange={(val) => setTripsPerMonth(val || 30)}
                        size="small"
                        style={{ width: '80px' }}
                      />
                    </div>
                    <Slider
                      min={1}
                      max={150}
                      step={1}
                      value={tripsPerMonth}
                      onChange={setTripsPerMonth}
                      tooltip={{ formatter: (val) => `${val} trips` }}
                    />
                  </div>
                </div>
              </Card>
            </Col>

            {/* Break-even visual charts */}
            <Col xs={24} lg={14}>
              <Card title={<strong style={{ color: 'var(--text-primary)' }}>Break-Even Gauge & Pricing Profit Curve</strong>} className="refund-card-glass">
                <Row gutter={[16, 16]}>
                  {/* Gauge */}
                  <Col xs={24} md={10} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '120px', height: '120px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Progress 
                        type="dashboard" 
                        percent={Math.min(100, Math.round((avgSeatsSold / breakEvenSeats) * 100))} 
                        status={isProfitable ? 'success' : 'exception'}
                        strokeColor={isProfitable ? '#10b981' : '#ff4d4f'}
                        width={120}
                        strokeWidth={8}
                        gapDegree={60}
                      />
                      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{avgSeatsSold} / 14</span>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Seats Sold</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '10px' }}>
                      {isProfitable ? (
                        <Tag color="success" style={{ fontWeight: 'bold' }}>PROFITABLE SCENARIO</Tag>
                      ) : (
                        <Tag color="error" style={{ fontWeight: 'bold' }}>LOSS SCENARIO</Tag>
                      )}
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.4' }}>
                        Break-even point is <strong>{breakEvenSeats} seats</strong>. Every seat sold starting from seat {breakEvenSeats + 1} adds <strong>{ticketPrice} EGP</strong> to net profits!
                      </div>
                    </div>
                  </Col>

                  {/* SVG Profit Curve Chart */}
                  <Col xs={24} md={14}>
                    <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                      <Text strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>Trip Profit Curve relative to Seats Sold</Text>
                    </div>
                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', padding: '10px', border: '1px solid var(--border)' }}>
                      <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ overflow: 'visible' }}>
                        {/* Grid lines */}
                        <line x1="30" y1={yZero} x2={svgWidth - 30} y2={yZero} stroke="rgba(255,255,255,0.15)" strokeDasharray="3,3" />
                        
                        {/* Break-even dot */}
                        {breakEvenSeats <= 14 && (
                          <circle 
                            cx={(breakEvenSeats / 14) * (svgWidth - 60) + 30}
                            cy={yZero}
                            r="5"
                            fill="#8b5cf6"
                          />
                        )}

                        {/* Chart Line */}
                        <polyline
                          fill="none"
                          stroke={isProfitable ? '#10b981' : '#ff4d4f'}
                          strokeWidth="3"
                          points={trendPoints}
                        />

                        {/* Current simulation dot */}
                        <circle 
                          cx={(avgSeatsSold / 14) * (svgWidth - 60) + 30}
                          cy={svgHeight - ((profitPerTrip - minProfitVal) / valRange) * (svgHeight - 40) - 20}
                          r="6"
                          fill="var(--primary-color)"
                          stroke="black"
                          strokeWidth="2"
                        />

                        {/* Labels */}
                        <text x="30" y="14" fill="var(--text-muted)" fontSize="9" textAnchor="start">Max Profit: {maxProfitVal.toFixed(0)} EGP</text>
                        <text x="30" y={svgHeight - 4} fill="var(--text-muted)" fontSize="9" textAnchor="start">Max Loss: {Math.abs(minProfitVal).toFixed(0)} EGP</text>
                        <text x={(breakEvenSeats / 14) * (svgWidth - 60) + 30} y={yZero - 6} fill="#8b5cf6" fontSize="9" fontWeight="bold" textAnchor="middle">Break-Even ({breakEvenSeats}s)</text>
                        <text x={(avgSeatsSold / 14) * (svgWidth - 60) + 30} y={svgHeight - ((profitPerTrip - minProfitVal) / valRange) * (svgHeight - 40) - 30} fill="var(--primary-color)" fontSize="10" fontWeight="bold" textAnchor="middle">Current ({profitPerTrip} EGP)</text>

                        {/* X Axis Labels */}
                        <text x="30" y={svgHeight - 12} fill="var(--text-muted)" fontSize="9" textAnchor="middle">0 seats</text>
                        <text x={svgWidth - 30} y={svgHeight - 12} fill="var(--text-muted)" fontSize="9" textAnchor="middle">14 seats</text>
                      </svg>
                    </div>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>

          {/* Occupancy scenario matrix comparisons table */}
          <Card title={<strong style={{ color: 'var(--text-primary)' }}>Occupancy Scenario Matrix Simulator</strong>} className="refund-card-glass" style={{ marginTop: '2rem' }}>
            <Table 
              dataSource={scenarioTableData}
              columns={columns}
              pagination={false}
            />
          </Card>
        </>
      ) : (
        <Alert type="info" message="Please add/select a route connection to begin simulating profitability." showIcon />
      )}
    </div>
  );
}
