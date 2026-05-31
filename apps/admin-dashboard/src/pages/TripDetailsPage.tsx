import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Row, Col, Space, Button, Table, Tag, Statistic, Badge, Spin, Tooltip, Breadcrumb, Typography, Modal, Select, Radio, Input } from 'antd';
import { ArrowLeft, User, Phone, Mail, Ticket, CreditCard, CheckCircle, Bus, AlertCircle, Briefcase, Settings, LayoutGrid, ArrowRightToLine } from 'lucide-react';
import { tripsAPI, bookingsAPI, usersAPI } from '../services/api';
import { message } from '../utils/antdGlobal';

const { Text, Title } = Typography;

export function TripDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [trip, setTrip] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [rewardSeatNum, setRewardSeatNum] = useState<number | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [passengerType, setPassengerType] = useState<'existing' | 'new'>('existing');
  const [reservationPurpose, setReservationPurpose] = useState<'reward' | 'employee'>('reward');
  const [newPassengerName, setNewPassengerName] = useState('');
  const [newPassengerEmail, setNewPassengerEmail] = useState('');
  const [newPassengerPhone, setNewPassengerPhone] = useState('');

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

  const fetchPassengersList = async () => {
    try {
      const res = await usersAPI.getByRole('PASSENGER');
      setClients(res || []);
    } catch (err) {
      console.error('Failed to fetch passengers', err);
    }
  };

  useEffect(() => {
    fetchPassengersList();
  }, []);

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

  const handleConfirmReward = async () => {
    if (!rewardSeatNum) return;
    try {
      setLoading(true);

      let targetUserId = selectedClientId;

      // 1. If registering a new user/employee on the fly
      if (passengerType === 'new') {
        if (!newPassengerName || !newPassengerEmail || !newPassengerPhone) {
          message.error('Please fill in all passenger details.');
          setLoading(false);
          return;
        }

        // Generate a random default password for the passenger
        const generatedPassword = Math.random().toString(36).substring(2, 10) + '!';
        
        const newUser = await usersAPI.create({
          name: newPassengerName,
          email: newPassengerEmail,
          phone: newPassengerPhone,
          role: 'PASSENGER',
          password: generatedPassword,
        });

        targetUserId = newUser._id || newUser.id;
        // Refresh local passengers list in background
        fetchPassengersList();
      }

      if (!targetUserId) {
        message.error('Please select or register a passenger.');
        setLoading(false);
        return;
      }

      const routeCheckpoints = trip.routeId?.checkpoints || [];
      const pickupCp = routeCheckpoints[0];
      const dropoffCp = routeCheckpoints[routeCheckpoints.length - 1];

      const paymentMethod = reservationPurpose === 'employee' ? 'COMPANY_EMPLOYEE' : 'ADMIN_REWARD';

      await bookingsAPI.create({
        tripId: trip._id || trip.id,
        seatNumbers: [rewardSeatNum],
        userId: targetUserId,
        isReward: true,
        paymentMethod,
        pickupStopId: pickupCp?.id || pickupCp?._id,
        dropoffStopId: dropoffCp?.id || dropoffCp?._id,
        pickupCheckpointId: pickupCp?.id || pickupCp?._id || pickupCp?.name,
        dropoffCheckpointId: dropoffCp?.id || dropoffCp?._id || dropoffCp?.name,
        pickupCheckpoint: pickupCp || undefined,
        dropoffCheckpoint: dropoffCp || undefined,
      });

      const successMsg = reservationPurpose === 'employee'
        ? `Seat ${rewardSeatNum} successfully reserved for employee! 🏢`
        : `Seat ${rewardSeatNum} successfully reserved as a reward! 🎁`;
        
      message.success(successMsg);
      setIsRewardModalOpen(false);
      setSelectedClientId('');
      setRewardSeatNum(null);
      setNewPassengerName('');
      setNewPassengerEmail('');
      setNewPassengerPhone('');
      setPassengerType('existing');
      fetchTripDetails();
    } catch (error: any) {
      message.error(error.message || 'Failed to reserve seat');
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

  // Seat click highlights passenger or opens reward modal
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
      setRewardSeatNum(seatNum);
      setIsRewardModalOpen(true);
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
  const renderSeat = (num: number) => {
    const isLocked = trip.lockedSeats?.includes(num);
    const occupant = seatOccupancyMap[num];
    const isOccupied = !!occupant;
    const isSelected = selectedSeat === num;

    let className = "bus-seat";
    if (isOccupied) className += " occupied";
    if (isSelected) className += " selected";
    if (isLocked) className += " locked-luggage";

    const content = (
      <div 
        className={className} 
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          minWidth: '40px',
          minHeight: '40px',
          width: '40px',
          height: '40px',
          cursor: isLocked ? 'not-allowed' : 'pointer',
          // Highlight style matching admin inspection
          boxShadow: isSelected ? '0 0 15px var(--primary-color, #f5b731), inset 0 1px 0 rgba(255, 255, 255, 0.2)' : undefined,
          transform: isSelected ? 'scale(1.12)' : 'none',
          borderWidth: isSelected ? '2px' : '1px',
          borderColor: isSelected ? 'var(--primary-color, #f5b731)' : undefined,
          zIndex: isSelected ? 5 : 1
        }}
        onClick={() => !isLocked && handleSeatClick(num)}
      >
        <div className="bus-seat-inner" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isLocked ? (
            <span style={{ display: 'flex', alignItems: 'center' }} title="Luggage Hold Area Locked"><Briefcase size={16} /></span>
          ) : (
            <>
              {/* Premium Cushion & Stitching */}
              <div className="bus-seat-cushion" />
              <div className="bus-seat-stitching" />
              <span style={{ 
                zIndex: 2, 
                fontSize: '0.78rem', 
                fontWeight: 'bold', 
                color: isSelected ? '#000000' : (isOccupied ? '#10b981' : 'var(--text-secondary)')
              }}>
                {num}
              </span>
            </>
          )}
        </div>
      </div>
    );

    if (isOccupied) {
      return (
        <Tooltip key={num} title={`Seat ${num}: ${occupant.passenger?.name || 'Anonymous'}`}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {content}
          </div>
        </Tooltip>
      );
    } else if (isLocked) {
      return (
        <Tooltip key={num} title={`Seat ${num} Locked for Luggage Hold`}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {content}
          </div>
        </Tooltip>
      );
    }

    return (
      <div key={num} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {content}
      </div>
    );
  };

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
        <Col xs={24} lg={8}>
          <Card 
            title={<strong style={{ color: 'var(--text-primary)' }}>Visual Bus Seating Map</strong>} 
            className="refund-card-glass"
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="bus-cabin">
                {/* Windshield */}
                <div className="bus-windshield windshield-opaque" style={{ marginBottom: '1rem' }} />
                
                {/* HiAce Dashboard */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                  <span title="Steering Wheel" style={{ opacity: 0.6 }}><Settings size={18} /></span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700 }}>DASHBOARD</span>
                  <span title="Dashboard" style={{ opacity: 0.5 }}><LayoutGrid size={16} /></span>
                </div>

                {/* Driver & VIP Row (Row 1) */}
                <div className="cabin-row" style={{ marginBottom: '1rem' }}>
                  <div className="bus-seat driver" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={16} />
                  </div>
                  <div className="cabin-aisle" />
                  {renderSeat(1)}
                </div>

                {/* Sliding Entry Door */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '2px 0 10px 0' }}>
                  <div className="door-entry-opaque" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', padding: '3px 8px', borderRadius: '4px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <ArrowRightToLine size={10} /> ENTRY
                  </div>
                </div>

                {/* Row 2 */}
                <div className="cabin-row">
                  {renderSeat(2)}
                  {renderSeat(3)}
                  <div className="cabin-aisle" />
                  {renderSeat(4)}
                </div>

                {/* Row 3 */}
                <div className="cabin-row">
                  {renderSeat(5)}
                  {renderSeat(6)}
                  <div className="cabin-aisle" />
                  {renderSeat(7)}
                </div>

                {/* Row 4 */}
                <div className="cabin-row">
                  {renderSeat(8)}
                  {renderSeat(9)}
                  <div className="cabin-aisle" />
                  {renderSeat(10)}
                </div>

                {/* Row 5 - Rear */}
                <div className="cabin-row" style={{ marginBottom: '0.5rem' }}>
                  {renderSeat(11)}
                  {renderSeat(12)}
                  {renderSeat(13)}
                  {renderSeat(14)}
                </div>

                {/* Rear bumper */}
                <div style={{ 
                  width: '60%', 
                  height: '6px', 
                  margin: '0.5rem auto 0', 
                  background: 'var(--border)', 
                  borderRadius: '0 0 4px 4px',
                  opacity: 0.6
                }} />
              </div>

              {/* Seating Map Legend */}
              <div style={{ marginTop: '20px', display: 'flex', gap: '15px', fontSize: '11px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Space><div style={{ width: '12px', height: '12px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '3px' }} /> Available</Space>
                <Space><div style={{ width: '12px', height: '12px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.15) 100%)', border: '1px solid rgba(16, 185, 129, 0.6)', borderRadius: '3px' }} /> Booked</Space>
                <Space><div style={{ width: '12px', height: '12px', background: 'linear-gradient(135deg, rgba(245, 183, 49, 0.25) 0%, rgba(217, 119, 6, 0.15) 100%)', border: '1px solid rgba(245, 183, 49, 0.6)', borderRadius: '3px' }} /> Luggage Hold</Space>
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

      {/* Reward / Employee Reservation Modal */}
      <Modal
        title={
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {reservationPurpose === 'employee' ? '🏢 Company Employee Reservation' : '🎁 Customer Reward Reservation'} : Seat {rewardSeatNum}
          </span>
        }
        open={isRewardModalOpen}
        onOk={handleConfirmReward}
        onCancel={() => {
          setIsRewardModalOpen(false);
          setSelectedClientId('');
          setRewardSeatNum(null);
          setNewPassengerName('');
          setNewPassengerEmail('');
          setNewPassengerPhone('');
          setPassengerType('existing');
        }}
        okText="Confirm Free Reservation"
        cancelText="Cancel"
        confirmLoading={loading}
        width={500}
      >
        <div style={{ padding: '10px 0' }}>
          
          {/* 1. Select Reservation Purpose */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              Reservation Purpose:
            </label>
            <Radio.Group 
              value={reservationPurpose} 
              onChange={(e) => setReservationPurpose(e.target.value)}
              buttonStyle="solid"
              style={{ width: '100%' }}
            >
              <Radio.Button value="reward" style={{ width: '50%', textAlign: 'center' }}>
                🎁 Customer Reward
              </Radio.Button>
              <Radio.Button value="employee" style={{ width: '50%', textAlign: 'center' }}>
                🏢 Company Employee
              </Radio.Button>
            </Radio.Group>
          </div>

          {/* 2. Select Passenger Account Type */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              Passenger Account Type:
            </label>
            <Radio.Group 
              value={passengerType} 
              onChange={(e) => setPassengerType(e.target.value)}
              buttonStyle="solid"
              style={{ width: '100%' }}
            >
              <Radio.Button value="existing" style={{ width: '50%', textAlign: 'center' }}>
                Search Registered Users
              </Radio.Button>
              <Radio.Button value="new" style={{ width: '50%', textAlign: 'center' }}>
                Register New Passenger
              </Radio.Button>
            </Radio.Group>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1.5rem 0', opacity: 0.4 }} />

          {/* 3. Conditional Form Fields */}
          {passengerType === 'existing' ? (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                Select Passenger (Passenger Account):
              </label>
              <Select
                showSearch
                placeholder="Search passenger by name, email or phone..."
                optionFilterProp="label"
                onChange={(value) => setSelectedClientId(value)}
                value={selectedClientId || undefined}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={clients.map(c => ({
                  value: c._id || c.id,
                  label: `${c.name} (${c.email || c.phone || 'No Contact Info'})`,
                }))}
                style={{ width: '100%' }}
                notFoundContent="No passengers registered yet"
              />
            </div>
          ) : (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '13px' }}>
                  Full Name:
                </label>
                <Input 
                  placeholder="e.g. John Doe" 
                  value={newPassengerName} 
                  onChange={(e) => setNewPassengerName(e.target.value)} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '13px' }}>
                  Email Address:
                </label>
                <Input 
                  type="email"
                  placeholder="e.g. john@company.com" 
                  value={newPassengerEmail} 
                  onChange={(e) => setNewPassengerEmail(e.target.value)} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '13px' }}>
                  Phone Number:
                </label>
                <Input 
                  placeholder="e.g. +201009999999" 
                  value={newPassengerPhone} 
                  onChange={(e) => setNewPassengerPhone(e.target.value)} 
                />
              </div>
            </Space>
          )}
        </div>
      </Modal>
    </div>
  );
}
