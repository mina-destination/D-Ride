import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Row, Col, Space, Button, Table, Tag, Statistic, Badge, Spin, Tooltip, Breadcrumb, Typography } from 'antd';
import { ArrowLeft, User, Phone, Mail, Ticket, CreditCard, CheckCircle, Bus, AlertCircle } from 'lucide-react';
import { tripsAPI, bookingsAPI } from '../services/api';
import { message } from '../utils/antdGlobal';

const { Text, Title } = Typography;

export function TripDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [trip, setTrip] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);

  const fetchTripDetails = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [tripRes, manifestRes] = await Promise.all([
        tripsAPI.getById(id),
        bookingsAPI.getTripManifest(id)
      ]);
      setTrip(tripRes);
      setBookings(manifestRes || []);
    } catch (error) {
      message.error('Failed to load trip manifest details');
      navigate('/trips');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTripDetails();
  }, [id]);

  const handleCheckIn = async (bookingId: string) => {
    try {
      setLoading(true);
      await bookingsAPI.checkIn(bookingId);
      message.success('Passenger checked in / boarded successfully! 🎟️');
      fetchTripDetails();
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message || 'Check-in failed';
      message.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !trip) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Spin size="large" tip="Loading Trip Manifest..." />
      </div>
    );
  }

  if (!trip) {
    return (
      <div style={{ padding: '2rem' }}>
        <AlertCircle size={40} style={{ color: 'red' }} />
        <h2>Trip details not found.</h2>
        <Button onClick={() => navigate('/trips')}>Back to Trips</Button>
      </div>
    );
  }

  // Seating capacity and mapping
  // Locked seats include seat 14 if locked for luggage
  const isSeat14Locked = trip.lockedSeats?.includes(14);
  const totalSeats = 14;

  // Build seat occupancy mapping
  const seatOccupancyMap: Record<number, { booking: any; passenger: any }> = {};
  bookings.forEach(b => {
    if (b.status !== 'CANCELLED') {
      b.seatNumbers?.forEach((seatNum: number) => {
        seatOccupancyMap[seatNum] = {
          booking: b,
          passenger: b.userId
        };
      });
    }
  });

  // Calculate statistics
  const confirmedBookings = bookings.filter(b => b.status !== 'CANCELLED');
  const seatsBookedCount = confirmedBookings.reduce((sum, b) => sum + (b.seatNumbers?.length || 0), 0);
  const checkedInCount = confirmedBookings.filter(b => b.status === 'BOARDED' || b.status === 'BOARDING' || b.status === 'COMPLETED').length;
  const occupancyPercentage = Math.round((seatsBookedCount / (totalSeats - (isSeat14Locked ? 1 : 0))) * 100) || 0;
  const tripRevenue = confirmedBookings.reduce((sum, b) => sum + (b.amountEGP || 0), 0);

  // Seat click highlights passenger
  const handleSeatClick = (seatNum: number) => {
    if (seatOccupancyMap[seatNum]) {
      setSelectedSeat(seatNum);
      const bookingId = seatOccupancyMap[seatNum].booking._id;
      // Scroll to booking card/row
      const element = document.getElementById(`booking-row-${bookingId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      setSelectedSeat(null);
    }
  };

  // Passenger Columns
  const manifestColumns = [
    {
      title: 'Seat #',
      dataIndex: 'seatNumbers',
      key: 'seats',
      render: (seats: number[]) => (
        <Space size={4}>
          {seats.map(s => (
            <Tag color="purple" style={{ fontWeight: 'bold' }} key={s}>Seat {s}</Tag>
          ))}
        </Space>
      ),
      sorter: (a: any, b: any) => (a.seatNumbers?.[0] || 0) - (b.seatNumbers?.[0] || 0),
    },
    {
      title: 'Passenger Details',
      key: 'passenger',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={1}>
          <Text strong style={{ color: 'var(--text-primary)' }}><User size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> {record.userId?.name || 'N/A'}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}><Phone size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> {record.userId?.phone || 'N/A'}</Text>
          <Text type="secondary" style={{ fontSize: '11px', color: 'var(--text-muted)' }}><Mail size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> {record.userId?.email || 'N/A'}</Text>
        </Space>
      ),
    },
    {
      title: 'Payment Status',
      key: 'payment',
      render: (_: any, record: any) => {
        let tagColor = 'default';
        if (record.paymentStatus === 'SUCCESS') tagColor = 'green';
        if (record.paymentStatus === 'PENDING') tagColor = 'orange';
        if (record.paymentStatus === 'FAILED') tagColor = 'red';
        if (record.paymentStatus === 'REFUNDED') tagColor = 'cyan';

        return (
          <Space direction="vertical" size={1}>
            <Tag color={tagColor} style={{ fontWeight: 'bold' }}>{record.paymentStatus}</Tag>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              EGP {record.amountEGP} via {record.paymentMethod || 'CARD'}
            </Text>
          </Space>
        );
      },
      sorter: (a: any, b: any) => (a.paymentStatus || '').localeCompare(b.paymentStatus || ''),
    },
    {
      title: 'Paymob Details',
      key: 'paymob',
      render: (_: any, record: any) => {
        return (
          <Space direction="vertical" size={1}>
            {record.paymobOrderId && (
              <Text style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Order ID: <Text copyable={{ text: record.paymobOrderId.toString() }} style={{ color: 'var(--text-primary)' }}>{record.paymobOrderId}</Text>
              </Text>
            )}
            {record.paymobPaymentId && (
              <Text style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Txn ID: <Text copyable={{ text: record.paymobPaymentId }} style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{record.paymobPaymentId}</Text>
              </Text>
            )}
            {!record.paymobOrderId && !record.paymobPaymentId && (
              <Text type="secondary" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>— (Mock/Wallet)</Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Booking Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === 'CONFIRMED') color = 'blue';
        if (status === 'BOARDED' || status === 'BOARDING') color = 'green';
        if (status === 'CANCELLED') color = 'red';
        return <Badge status={color as any} text={status} />;
      },
      sorter: (a: any, b: any) => (a.status || '').localeCompare(b.status || ''),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => {
        const canCheckIn = record.status === 'CONFIRMED' && record.paymentStatus === 'SUCCESS';
        return (
          <Space>
            {canCheckIn ? (
              <Button type="primary" size="small" onClick={() => handleCheckIn(record._id)} style={{ background: '#10b981', color: 'black', fontWeight: 'bold' }}>
                Check-In Passenger
              </Button>
            ) : record.status === 'BOARDED' || record.status === 'BOARDING' ? (
              <Tag color="success">Boarded ✓</Tag>
            ) : record.status === 'CANCELLED' ? (
              <Text type="secondary" delete>Cancelled</Text>
            ) : (
              <Text type="secondary">—</Text>
            )}
          </Space>
        );
      },
    },
  ];

  // Visual microbus seat rendering helper
  // Grid layout for 14 seat bus:
  // Row 1: [DRIVER] [Seat 1] [Aisle] [Seat 2]
  // Row 2: [Seat 3] [Seat 4] [Aisle] [Seat 5]
  // Row 3: [Seat 6] [Seat 7] [Aisle] [Seat 8]
  // Row 4: [Seat 9] [Seat 10] [Aisle] [Seat 11]
  // Row 5: [Seat 12] [Seat 13] [Aisle] [Seat 14]
  const seatLayout = [
    ['DRIVER', 1, null, 2],
    [3, 4, null, 5],
    [6, 7, null, 8],
    [9, 10, null, 11],
    [12, 13, null, 14]
  ];

  return (
    <div style={{ padding: '2rem 0' }}>
      {/* Breadcrumb Navigation */}
      <Breadcrumb style={{ marginBottom: '1.5rem' }}>
        <Breadcrumb.Item>
          <span onClick={() => navigate('/trips')} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>
            Trips Management
          </span>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>
            Trip Details & Seating
          </span>
        </Breadcrumb.Item>
      </Breadcrumb>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <Space size="large">
          <Button onClick={() => navigate('/trips')} icon={<ArrowLeft size={16} />} style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            Back to Trips
          </Button>
          <div>
            <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }} className="title-outfit">
              <Bus size={28} style={{ color: 'var(--primary-color)' }} /> Manifest: {trip.routeId?.name || 'Trip Details'}
            </Title>
            <Text type="secondary">
              Departure: <strong>{new Date(trip.departureTime).toLocaleString()}</strong> | Status: <Tag color={trip.status === 'COMPLETED' ? 'green' : 'blue'}>{trip.status}</Tag>
            </Text>
          </div>
        </Space>
      </div>

      {/* Quick stats row */}
      <Row gutter={[16, 16]} style={{ marginBottom: '2rem' }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="refund-card-glass">
            <Statistic 
              title={<span style={{ color: 'var(--text-secondary)' }}>Booked Occupancy</span>}
              value={`${seatsBookedCount} / ${totalSeats - (isSeat14Locked ? 1 : 0)}`}
              valueStyle={{ color: 'var(--primary)', fontWeight: 800 }}
              prefix={<Ticket size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Capacity: {occupancyPercentage}% Occupied
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="refund-card-glass">
            <Statistic 
              title={<span style={{ color: 'var(--text-secondary)' }}>Trip Gross Revenue</span>}
              value={tripRevenue}
              suffix=" EGP"
              valueStyle={{ color: '#10b981', fontWeight: 800 }}
              prefix={<CreditCard size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Base ticket price: {trip.priceEGP} EGP
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="refund-card-glass">
            <Statistic 
              title={<span style={{ color: 'var(--text-secondary)' }}>Checked-In / Boarded</span>}
              value={checkedInCount}
              suffix={` / ${seatsBookedCount}`}
              valueStyle={{ color: '#3b82f6', fontWeight: 800 }}
              prefix={<CheckCircle size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Checked-in boarding pass completion
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="refund-card-glass">
            <Statistic 
              title={<span style={{ color: 'var(--text-secondary)' }}>Active Fleet Details</span>}
              value={trip.vehicleId?.licensePlate ? 'Assigned' : 'Unassigned'}
              valueStyle={{ color: 'var(--text-primary)', fontWeight: 800 }}
              prefix={<Bus size={18} style={{ marginRight: '6px', verticalAlign: 'middle' }} />}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {trip.vehicleId ? `${trip.vehicleId.make} (${trip.vehicleId.licensePlate})` : 'No fleet vehicle'}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* Visual Seating Layout */}
        <Col xs={24} lg={8}>
          <Card 
            title={<strong style={{ color: 'var(--text-primary)' }}>Visual Bus Seating Map</strong>} 
            className="refund-card-glass"
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '240px',
                background: 'rgba(10, 10, 18, 0.4)',
                border: '3px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '32px 32px 20px 20px',
                padding: '24px 16px 20px 16px',
                position: 'relative',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
              }}>
                {/* Left Side Mirror */}
                <div style={{
                  position: 'absolute',
                  top: '32px',
                  left: '-9px',
                  width: '8px',
                  height: '16px',
                  borderRadius: '4px 0 0 4px',
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.2)'
                }} />

                {/* Right Side Mirror */}
                <div style={{
                  position: 'absolute',
                  top: '32px',
                  right: '-9px',
                  width: '8px',
                  height: '16px',
                  borderRadius: '0 4px 4px 0',
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.2)'
                }} />

                {/* Left glowing Headlight */}
                <div style={{
                  position: 'absolute',
                  top: '-3px',
                  left: '20px',
                  width: '16px',
                  height: '6px',
                  borderRadius: '3px',
                  background: '#f5b731',
                  boxShadow: '0 -4px 12px #f5b731'
                }} />

                {/* Right glowing Headlight */}
                <div style={{
                  position: 'absolute',
                  top: '-3px',
                  right: '20px',
                  width: '16px',
                  height: '6px',
                  borderRadius: '3px',
                  background: '#f5b731',
                  boxShadow: '0 -4px 12px #f5b731'
                }} />

                {/* Premium Curved Windshield */}
                <div style={{
                  height: '18px',
                  background: 'linear-gradient(to bottom, rgba(59, 130, 246, 0.25), rgba(59, 130, 246, 0.05))',
                  border: '1.5px solid rgba(59, 130, 246, 0.35)',
                  borderRadius: '8px 8px 3px 3px',
                  margin: '-12px 6px 14px 6px',
                  position: 'relative'
                }}>
                  {/* Rear View Mirror */}
                  <div style={{
                    position: 'absolute',
                    bottom: '2px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '18px',
                    height: '4px',
                    background: 'rgba(255,255,255,0.2)',
                    borderRadius: '1px'
                  }} />
                </div>

                {/* Dashboard Barrier */}
                <div style={{
                  height: '3px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  margin: '0 6px 16px 6px',
                  borderRadius: '1.5px'
                }} />

                {/* Seating Grid */}
                <div style={{ display: 'grid', gap: '16px' }}>
                  {seatLayout.map((row, rIdx) => (
                    <div key={rIdx} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', justifyItems: 'center', alignItems: 'center' }}>
                      {row.map((col, cIdx) => {
                        if (col === null) {
                          // Aisle walking path
                          return <div key={cIdx} style={{ width: '38px', height: '42px' }} />;
                        }

                        if (col === 'DRIVER') {
                          return (
                            <div 
                              key={cIdx} 
                              style={{ 
                                width: '38px', 
                                height: '42px', 
                                borderRadius: '6px 6px 10px 10px', 
                                background: 'rgba(255, 255, 255, 0.03)', 
                                border: '1px dashed rgba(255, 255, 255, 0.15)',
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                position: 'relative',
                                color: 'var(--text-muted)'
                              }}
                              title="Driver Seat"
                            >
                              {/* Driver Headrest */}
                              <div style={{
                                position: 'absolute',
                                top: '-6px',
                                width: '18px',
                                height: '6px',
                                borderRadius: '3px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px dashed rgba(255, 255, 255, 0.15)'
                              }} />
                              
                              {/* Steering Wheel Icon SVG */}
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                                <circle cx="12" cy="12" r="10" />
                                <circle cx="12" cy="12" r="3" />
                                <line x1="12" y1="2" x2="12" y2="9" />
                                <line x1="12" y1="15" x2="12" y2="22" />
                                <line x1="2" y1="12" x2="9" y2="12" />
                                <line x1="15" y1="12" x2="22" y2="12" />
                              </svg>
                            </div>
                          );
                        }

                        const seatNum = col as number;
                        const isLocked = seatNum === 14 && isSeat14Locked;
                        const occupant = seatOccupancyMap[seatNum];
                        const isOccupied = !!occupant;
                        
                        let bg = 'rgba(255, 255, 255, 0.04)';
                        let border = '1px solid rgba(255, 255, 255, 0.08)';
                        let textColor = 'var(--text-secondary)';
                        let headrestBg = 'rgba(255, 255, 255, 0.08)';
                        let shadow = 'none';
                        
                        if (isLocked) {
                          bg = 'linear-gradient(135deg, rgba(245, 183, 49, 0.25) 0%, rgba(217, 119, 6, 0.15) 100%)';
                          border = '1px solid rgba(245, 183, 49, 0.6)';
                          textColor = '#f5b731';
                          headrestBg = 'rgba(245, 183, 49, 0.6)';
                          shadow = '0 4px 12px rgba(245, 183, 49, 0.15)';
                        } else if (isOccupied) {
                          bg = 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.15) 100%)';
                          border = '1px solid rgba(16, 185, 129, 0.6)';
                          textColor = '#10b981';
                          headrestBg = 'rgba(16, 185, 129, 0.6)';
                          shadow = '0 4px 12px rgba(16, 185, 129, 0.15)';
                        }

                        const content = (
                          <div 
                            onClick={() => !isLocked && handleSeatClick(seatNum)}
                            className="vehicle-seat-item"
                            style={{ 
                              width: '38px', 
                              height: '42px', 
                              borderRadius: '6px 6px 10px 10px', 
                              background: bg,
                              border: border,
                              display: 'flex', 
                              flexDirection: 'column',
                              alignItems: 'center', 
                              justifyContent: 'center',
                              cursor: isLocked ? 'not-allowed' : 'pointer',
                              color: textColor,
                              fontSize: '11px',
                              fontWeight: 'bold',
                              transition: 'all 0.2s',
                              position: 'relative',
                              boxShadow: selectedSeat === seatNum ? '0 0 12px var(--primary-color)' : shadow,
                              transform: selectedSeat === seatNum ? 'scale(1.15)' : 'none',
                              borderWidth: selectedSeat === seatNum ? '2px' : '1px',
                              borderColor: selectedSeat === seatNum ? 'var(--primary-color)' : undefined
                            }}
                          >
                            {/* Seat Headrest */}
                            <div style={{
                              position: 'absolute',
                              top: '-6px',
                              width: '18px',
                              height: '6px',
                              borderRadius: '3px',
                              background: headrestBg,
                              border: border,
                              borderBottom: 'none'
                            }} />

                            <div>{seatNum}</div>
                            {isOccupied && <div style={{ fontSize: '7px', opacity: 0.8, fontWeight: 500 }}>Booked</div>}
                            {isLocked && <div style={{ fontSize: '7px', opacity: 0.8, fontWeight: 500 }}>Hold</div>}
                          </div>
                        );

                        if (isOccupied) {
                          return (
                            <Tooltip key={cIdx} title={`Seat ${seatNum}: ${occupant.passenger?.name || 'Anonymous'}`}>
                              {content}
                            </Tooltip>
                          );
                        } else if (isLocked) {
                          return (
                            <Tooltip key={cIdx} title={`Seat 14 Locked for Luggage Hold`}>
                              {content}
                            </Tooltip>
                          );
                        }

                        return content;
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Seating Map Legend */}
              <div style={{ marginTop: '20px', display: 'flex', gap: '15px', fontSize: '11px' }}>
                <Space><div style={{ width: '12px', height: '12px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border)', borderRadius: '3px' }} /> Available</Space>
                <Space><div style={{ width: '12px', height: '12px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', borderRadius: '3px' }} /> Booked</Space>
                <Space><div style={{ width: '12px', height: '12px', background: 'rgba(245, 183, 49, 0.15)', border: '1px solid #f5b731', borderRadius: '3px' }} /> Luggage Hold</Space>
              </div>
            </div>
          </Card>
        </Col>

        {/* Passenger details manifest list */}
        <Col xs={24} lg={16}>
          <Card 
            title={<strong style={{ color: 'var(--text-primary)' }}>Passenger Manifest Ledger & Payments</strong>}
            className="refund-card-glass"
          >
            <Table 
              dataSource={bookings} 
              columns={manifestColumns} 
              rowKey="_id"
              rowClassName={(record) => {
                let classes = '';
                if (record.seatNumbers?.includes(selectedSeat)) classes += ' seat-highlight-row';
                return classes;
              }}
              onRow={(record) => ({
                id: `booking-row-${record._id}`,
                style: record.seatNumbers?.includes(selectedSeat) ? {
                  background: 'rgba(16, 185, 129, 0.05)',
                  transition: 'background 0.3s'
                } : {}
              })}
              pagination={false}
              locale={{ emptyText: 'No passengers have booked seats on this trip yet.' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Operator and Fleet Details section */}
      <Row gutter={[24, 24]} style={{ marginTop: '2.5rem' }}>
        <Col xs={24} md={12}>
          <Card title="Driver Operator Assignment" className="refund-card-glass">
            {trip.driverId ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {trip.driverId.name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{trip.driverId.name}</h3>
                    <Text type="secondary">System Assigned Operator</Text>
                  </div>
                </div>
                <div style={{ marginTop: '10px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div>📞 Contact: <strong>{trip.driverId.phone}</strong></div>
                  <div>✉️ Email: <strong>{trip.driverId.email}</strong></div>
                </div>
              </Space>
            ) : (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <AlertCircle size={20} style={{ color: 'orange' }} />
                <Text type="secondary">No driver operator assigned to this trip.</Text>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Fleet Vehicle Specs" className="refund-card-glass">
            {trip.vehicleId ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--border)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bus size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{trip.vehicleId.make} {trip.vehicleId.model}</h3>
                    <Text type="secondary">Plate Number: <strong>{trip.vehicleId.licensePlate}</strong></Text>
                  </div>
                </div>
                <div style={{ marginTop: '10px', fontSize: '13px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>Type: <strong>{trip.vehicleId.type}</strong></div>
                  <div>Total Seats: <strong>{trip.vehicleId.seats}</strong></div>
                  <div>Current Status: <Tag color={trip.vehicleId.status === 'ACTIVE' ? 'green' : 'orange'}>{trip.vehicleId.status}</Tag></div>
                </div>
              </Space>
            ) : (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <AlertCircle size={20} style={{ color: 'orange' }} />
                <Text type="secondary">No vehicle fleet assigned to this trip.</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
