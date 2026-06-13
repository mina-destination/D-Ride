import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Space, Tag, Typography, Input, Select, Card, DatePicker, Drawer, Form, Divider, Timeline, Modal } from 'antd';
import { Popconfirm } from '../components/Popconfirm';
import { message } from '../utils/antdGlobal';
import { bookingsAPI, usersAPI, tripsAPI } from '../services/api';
import { Ticket, Download, Eye, Plus, CheckCircle2, TicketPercent, ShieldCheck, UserCheck, XCircle, History } from 'lucide-react';
import { exportToCSV } from '../utils/csv';
import dayjs from 'dayjs';

const { Title, Paragraph } = Typography;

export function BookingsPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);
  
  // Row selection & bulk states
  const [selectedRowKeys, setSelectedRowKeys] = useState<any[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Booking details modal states
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [activeBooking, setActiveBooking] = useState<any | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Manual booking creator states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [passengers, setPassengers] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
  const [occupiedSeats, setOccupiedSeats] = useState<number[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [createLoading, setCreateLoading] = useState(false);

  const getTimelineEvents = (booking: any) => {
    const events: { color: string; children: string }[] = [];
    if (booking.createdAt) {
      events.push({ color: 'blue', children: `Booking created on ${dayjs(booking.createdAt).format('MMM D, YYYY h:mm A')}` });
    }
    if (booking.status === 'CONFIRMED' || booking.status === 'BOARDED' || booking.status === 'COMPLETED') {
      events.push({ color: 'green', children: 'Booking confirmed' });
    }
    if (booking.checkedIn) {
      events.push({ color: 'blue', children: `Passenger checked in${booking.checkedInAt ? ` on ${dayjs(booking.checkedInAt).format('MMM D, YYYY h:mm A')}` : ''}` });
    }
    if (booking.status === 'COMPLETED') {
      events.push({ color: 'gray', children: 'Trip completed' });
    }
    if (booking.status === 'CANCELLED') {
      events.push({ color: 'red', children: `Booking cancelled${booking.cancelledAt ? ` on ${dayjs(booking.cancelledAt).format('MMM D, YYYY h:mm A')}` : ''}` });
    }
    if (booking.paymentStatus === 'SUCCESS') {
      events.push({ color: 'green', children: 'Payment received' });
    }
    if (booking.qrVerificationToken && booking.verified) {
      events.push({ color: 'purple', children: 'QR ticket verified' });
    }
    return events;
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await bookingsAPI.getAll();
      setBookings(res);
    } catch (error) {
      message.error('Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancel = async (id: string) => {
    try {
      await bookingsAPI.cancel(id);
      message.success('Booking cancelled successfully');
      fetchBookings();
      if (activeBooking && activeBooking._id === id) {
        setIsDetailsOpen(false);
      }
    } catch (error) {
      message.error('Failed to cancel booking');
    }
  };

  const handleBulkCancel = async () => {
    try {
      setBulkLoading(true);
      const toCancel = bookings.filter(b => selectedRowKeys.includes(b._id) && b.status !== 'CANCELLED');
      if (toCancel.length === 0) {
        message.warning('All selected bookings are already cancelled');
        return;
      }
      await Promise.all(toCancel.map(b => bookingsAPI.cancel(b._id)));
      message.success(`Successfully cancelled ${toCancel.length} bookings`);
      setSelectedRowKeys([]);
      fetchBookings();
    } catch (error) {
      message.error('Some bookings failed to cancel');
    } finally {
      setBulkLoading(false);
    }
  };

  // Open Details Modal
  const handleOpenDetails = (booking: any) => {
    setActiveBooking(booking);
    setPromoCode('');
    setVerificationToken(booking.qrVerificationToken || '');
    setIsDetailsOpen(true);
  };

  // Check In Passenger
  const handleCheckIn = async () => {
    if (!activeBooking) return;
    try {
      setCheckInLoading(true);
      const res = await bookingsAPI.checkIn(activeBooking._id);
      message.success('Passenger successfully checked in.');
      setActiveBooking(res);
      fetchBookings();
    } catch (err: any) {
      message.error(err.message || 'Check-in failed');
    } finally {
      setCheckInLoading(false);
    }
  };

  // Apply Coupon Code
  const handleApplyPromo = async () => {
    if (!activeBooking || !promoCode.trim()) return;
    try {
      setPromoLoading(true);
      const res = await bookingsAPI.applyPromo(activeBooking._id, promoCode.trim());
      message.success('Promo code successfully applied.');
      setActiveBooking(res);
      fetchBookings();
    } catch (err: any) {
      message.error(err.message || 'Failed to apply promo code');
    } finally {
      setPromoLoading(false);
    }
  };

  // Verify Ticket
  const handleVerifyTicket = async () => {
    if (!activeBooking || !verificationToken.trim()) return;
    try {
      setVerifyLoading(true);
      const res = await bookingsAPI.verifyTicket(activeBooking._id, verificationToken.trim());
      message.success('Ticket verification token validated successfully.');
      setActiveBooking(res);
      fetchBookings();
    } catch (err: any) {
      message.error(err.message || 'Ticket verification failed');
    } finally {
      setVerifyLoading(false);
    }
  };

  // Open Creator Modal
  const handleOpenCreator = async () => {
    setIsCreateOpen(true);
    setSelectedTrip(null);
    setOccupiedSeats([]);
    setSelectedSeats([]);
    createForm.resetFields();
    try {
      const [passengersRes, tripsRes] = await Promise.all([
        usersAPI.getByRole('PASSENGER'),
        tripsAPI.getAll(),
      ]);
      setPassengers(passengersRes);
      // Filter out cancelled trips
      setTrips((tripsRes || []).filter((t: any) => t.status !== 'CANCELLED' && t.status !== 'COMPLETED'));
    } catch (err) {
      message.error('Failed to load options for booking creator');
    }
  };

  // Trip Selection Change handler
  const handleTripChange = async (tripId: string) => {
    const trip = trips.find(t => t._id === tripId || t.id === tripId);
    setSelectedTrip(trip);
    setSelectedSeats([]);
    createForm.setFieldsValue({ seatNumbers: [], pickupCheckpoint: undefined, dropoffCheckpoint: undefined });
    if (trip) {
      try {
        const occupied = await bookingsAPI.getOccupiedSeats(trip._id || trip.id);
        setOccupiedSeats(occupied || []);
      } catch (err) {
        console.error('Failed to fetch occupied seats', err);
        setOccupiedSeats([]);
      }
    }
  };

  // Handle seat clicks
  const toggleSeatSelection = (seatNum: number) => {
    setSelectedSeats(prev => {
      const next = prev.includes(seatNum) 
        ? prev.filter(s => s !== seatNum)
        : [...prev, seatNum];
      createForm.setFieldsValue({ seatNumbers: next });
      return next;
    });
  };

  // Submit manual booking
  const handleCreateSubmit = async (values: any) => {
    if (selectedSeats.length === 0) {
      message.error('Please select at least one seat from the grid');
      return;
    }
    try {
      setCreateLoading(true);
      const tripPrice = selectedTrip?.priceEGP || 250;
      const amount = tripPrice * selectedSeats.length;

      const payload = {
        userId: values.userId,
        tripId: values.tripId,
        seatNumbers: selectedSeats,
        amountEGP: amount,
        pickupCheckpoint: values.pickupCheckpoint ? { name: values.pickupCheckpoint } : undefined,
        dropoffCheckpoint: values.dropoffCheckpoint ? { name: values.dropoffCheckpoint } : undefined,
        status: 'CONFIRMED',
        paymentStatus: 'SUCCESS', // Manual admin booking overrides payment checks
      };

      await bookingsAPI.create(payload);
      message.success('Booking successfully created!');
      setIsCreateOpen(false);
      fetchBookings();
    } catch (err: any) {
      message.error(err.message || 'Failed to create booking');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleExportData = (dataToExport: any[]) => {
    const headers = [
      { key: '_id', label: 'Booking ID', transform: (val: string) => val.toUpperCase() },
      { key: 'userId.name', label: 'Passenger Name' },
      { key: 'userId.phone', label: 'Passenger Phone' },
      { key: 'tripId.routeId.name', label: 'Route Name' },
      { key: 'tripId.departureTime', label: 'Departure Time', transform: (val: string) => val ? new Date(val).toLocaleString() : '' },
      { key: 'seatNumbers', label: 'Seat Numbers', transform: (val: any, record: any) => {
        const seats = val || (record.seatNumber ? [record.seatNumber] : []);
        return seats.join(', ');
      }},
      { key: 'amountEGP', label: 'Fare (EGP)' },
      { key: 'status', label: 'Booking Status' },
      { key: 'paymentStatus', label: 'Payment Status' },
    ];
    exportToCSV(dataToExport, headers, 'bookings_report');
  };

  const handleExport = () => {
    handleExportData(filteredBookings);
  };

  const handleExportSelected = () => {
    const selectedData = bookings.filter(b => selectedRowKeys.includes(b._id));
    handleExportData(selectedData);
  };

  const filteredBookings = bookings.filter(b => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      b.userId?.name?.toLowerCase().includes(term) ||
      b.userId?.email?.toLowerCase().includes(term) ||
      b.tripId?.routeId?.name?.toLowerCase().includes(term) ||
      b._id?.toLowerCase().includes(term);

    const matchesStatus = 
      statusFilter === 'ALL' || 
      (b.status || 'PENDING') === statusFilter;

    const matchesPaymentStatus = 
      paymentStatusFilter === 'ALL' || 
      (b.paymentStatus || 'PENDING') === paymentStatusFilter;

    const matchesDate = 
      !selectedDate || 
      (b.tripId?.departureTime && dayjs(b.tripId.departureTime).isSame(selectedDate, 'day'));

    return matchesSearch && matchesStatus && matchesPaymentStatus && matchesDate;
  });

  const columns = [
    {
      title: 'Booking ID',
      dataIndex: '_id',
      key: 'id',
      sorter: (a: any, b: any) => a._id.localeCompare(b._id),
      render: (id: string) => <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{id.slice(-6).toUpperCase()}</span>,
    },
    {
      title: 'Passenger',
      key: 'passenger',
      sorter: (a: any, b: any) => (a.userId?.name || '').localeCompare(b.userId?.name || ''),
      render: (_: any, record: any) => (
        <div>
          <strong style={{ display: 'block' }}>{record.userId?.name || 'Unknown User'}</strong>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{record.userId?.phone || 'N/A'}</span>
        </div>
      ),
    },
    {
      title: 'Route',
      key: 'route',
      sorter: (a: any, b: any) => (a.tripId?.routeId?.name || '').localeCompare(b.tripId?.routeId?.name || ''),
      render: (_: any, record: any) => {
        const tripId = record.tripId?._id || record.tripId;
        return (
          <Button
            type="link"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/trips/${tripId}`);
            }}
            style={{ padding: 0, height: 'auto', fontWeight: 'bold', fontSize: '14px', textAlign: 'left' }}
          >
            {record.tripId?.routeId?.name || 'N/A'}
          </Button>
        );
      },
    },
    {
      title: 'Seat(s)',
      key: 'seats',
      render: (_: any, record: any) => {
        const seats = record.seatNumbers || (record.seatNumber ? [record.seatNumber] : []);
        if (seats.length === 0) return <Tag color="default">Any</Tag>;
        return (
          <Space size={[4, 4]} wrap>
            {seats.map((seat: number) => (
              <Tag key={seat} color="orange" style={{ fontWeight: 'bold' }}>
                Seat {seat}
              </Tag>
            ))}
          </Space>
        );
      }
    },
    {
      title: 'Boarding No.',
      key: 'boardingNumber',
      width: 110,
      render: (_: any, record: any) => {
        const bn = record.boardingNumber;
        return bn ? <Tag color="purple" style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>#{bn}</Tag> : <span style={{ color: '#556987' }}>—</span>;
      },
    },
    {
      title: 'Fare',
      dataIndex: 'amountEGP',
      key: 'amountEGP',
      sorter: (a: any, b: any) => (a.amountEGP || 0) - (b.amountEGP || 0),
      render: (amount: number) => <strong>{amount} EGP</strong>,
    },
    {
      title: 'Booking Status',
      dataIndex: 'status',
      key: 'status',
      sorter: (a: any, b: any) => (a.status || '').localeCompare(b.status || ''),
      render: (status: string) => {
        let color = 'gold';
        const s = status || 'PENDING';
        if (s === 'CONFIRMED') color = 'green';
        if (s === 'BOARDED') color = 'blue';
        if (s === 'COMPLETED') color = 'default';
        if (s === 'CANCELLED') color = 'red';
        return <Tag color={color} style={{ fontWeight: 'bold' }}>{s}</Tag>;
      },
    },
    {
      title: 'Payment Status',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      sorter: (a: any, b: any) => (a.paymentStatus || '').localeCompare(b.paymentStatus || ''),
      render: (status: string) => {
        let color = 'gold';
        const s = status || 'PENDING';
        if (s === 'SUCCESS') color = 'green';
        if (s === 'FAILED') color = 'red';
        return <Tag color={color} style={{ fontWeight: 'bold' }}>{s}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 260,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="text" size="small" icon={<Eye size={14} />} onClick={() => handleOpenDetails(record)}>
            Details
          </Button>
          {record.status === 'CONFIRMED' && !record.checkedIn && (
            <Button type="text" size="small" icon={<UserCheck size={14} />} style={{ color: '#10b981' }} onClick={async () => {
              try {
                await bookingsAPI.checkIn(record._id);
                message.success('Passenger checked in successfully');
                fetchBookings();
              } catch { message.error('Check-in failed'); }
            }}>
              Check In
            </Button>
          )}
          {record.status === 'CONFIRMED' && (
            <Button type="text" size="small" icon={<ShieldCheck size={14} />} style={{ color: '#8b5cf6' }} onClick={async () => {
              const token = record.qrVerificationToken;
              if (!token) { message.warning('No verification token available'); return; }
              try {
                await bookingsAPI.verifyTicket(record._id, token);
                message.success('Ticket verified');
                fetchBookings();
              } catch { message.error('Verification failed'); }
            }}>
              Verify
            </Button>
          )}
          {record.status !== 'CANCELLED' ? (
            <Popconfirm
              title="Cancel booking?"
              description="This will release reserved seats."
              onConfirm={() => handleCancel(record._id)}
              okText="Yes, Cancel"
              cancelText="No"
            >
              <Button type="link" size="small" danger style={{ padding: 0 }}>
                <XCircle size={14} style={{ marginRight: 2 }} /> Cancel
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '2rem 0' }}>
      <div className="dashboard-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <Title level={2} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Ticket size={28} /> Bookings Management
          </Title>
          <Paragraph>View passenger seat reservations, issue manual tickets, and verify boardings</Paragraph>
        </div>
        <Space wrap>
          <Input.Search
            placeholder="Search passenger, route, ID..."
            value={searchTerm}
            onSearch={value => setSearchTerm(value)}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <DatePicker
            placeholder="Departure Date"
            value={selectedDate}
            onChange={value => setSelectedDate(value)}
            style={{ width: 170 }}
            allowClear
          />
          <Select
            value={statusFilter}
            onChange={value => setStatusFilter(value)}
            style={{ width: 140 }}
          >
            <Select.Option value="ALL">All Statuses</Select.Option>
            <Select.Option value="CONFIRMED">Confirmed</Select.Option>
            <Select.Option value="PENDING">Pending</Select.Option>
            <Select.Option value="BOARDED">Boarded</Select.Option>
            <Select.Option value="COMPLETED">Completed</Select.Option>
            <Select.Option value="CANCELLED">Cancelled</Select.Option>
          </Select>
          <Select
            value={paymentStatusFilter}
            onChange={value => setPaymentStatusFilter(value)}
            style={{ width: 140 }}
          >
            <Select.Option value="ALL">All Payments</Select.Option>
            <Select.Option value="SUCCESS">Success</Select.Option>
            <Select.Option value="PENDING">Pending</Select.Option>
            <Select.Option value="FAILED">Failed</Select.Option>
          </Select>
          <Button 
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              setSelectedRowKeys([]);
            }}
            type={isSelectionMode ? "primary" : "default"}
            ghost={isSelectionMode}
          >
            {isSelectionMode ? "Exit Selection" : "Bulk Select"}
          </Button>
          <Button 
            onClick={handleExport} 
            icon={<Download size={16} />}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            Export CSV
          </Button>
          <Button 
            type="primary" 
            icon={<Plus size={16} />} 
            onClick={handleOpenCreator}
            style={{ background: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}
          >
            Create Booking
          </Button>
        </Space>
      </div>

      {selectedRowKeys.length > 0 && (
        <Card style={{ marginBottom: '1rem', background: '#171a23', borderColor: '#232938' }} size="small">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'white', fontWeight: 'bold' }}>Selected {selectedRowKeys.length} items</span>
            <Space>
              <Button size="small" onClick={handleExportSelected}>Export Selected</Button>
              <Popconfirm title="Cancel selected bookings?" onConfirm={handleBulkCancel}>
                <Button size="small" type="primary" danger loading={bulkLoading}>Cancel Selected</Button>
              </Popconfirm>
            </Space>
          </div>
        </Card>
      )}

      <div className="card glass" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <Table 
          rowSelection={isSelectionMode ? {
            selectedRowKeys,
            onChange: (keys: any[]) => setSelectedRowKeys(keys)
          } : undefined}
          dataSource={filteredBookings} 
          columns={columns} 
          rowKey="_id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
          rowClassName={(record: any) => {
            const status = record.status || '';
            if (status === 'CONFIRMED') return 'booking-row-confirmed';
            if (status === 'CANCELLED') return 'booking-row-cancelled';
            if (status === 'BOARDED') return 'booking-row-boarded';
            if (status === 'COMPLETED') return 'booking-row-completed';
            return '';
          }}
        />
      </div>

      {/* Booking Details Drawer */}
      <Drawer
        title={<div style={{ color: 'white', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Ticket size={20} color="var(--primary-color)" /> Booking Information</div>}
        open={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        width={560}
        destroyOnClose={true}
        styles={{ body: { background: 'var(--surface)', padding: '24px' } }}
        extra={<Button onClick={() => setIsDetailsOpen(false)}>Close</Button>}
      >
        {activeBooking && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#8f9cae' }}>
            
            {/* Row 1: ID & Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#556987' }}>BOOKING ID</span>
                <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: 'white', fontWeight: 'bold' }}>{activeBooking._id.toUpperCase()}</div>
              </div>
              <Space>
                <Tag color={activeBooking.status === 'CONFIRMED' ? 'green' : activeBooking.status === 'CANCELLED' ? 'red' : activeBooking.status === 'BOARDED' ? 'blue' : activeBooking.status === 'COMPLETED' ? 'default' : 'gold'} style={{ fontWeight: 'bold' }}>{activeBooking.status}</Tag>
                <Tag color={activeBooking.paymentStatus === 'SUCCESS' ? 'green' : 'orange'} style={{ fontWeight: 'bold' }}>{activeBooking.paymentStatus}</Tag>
              </Space>
            </div>

            <Divider style={{ margin: '8px 0', borderColor: '#232938' }} />

            {/* Passenger profile */}
            <div>
              <Title level={5} style={{ color: 'white', margin: '0 0 8px 0' }}>Passenger Profile</Title>
              <div style={{ background: '#161922', padding: '12px', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <span><strong>Name:</strong> <span style={{ color: 'white' }}>{activeBooking.userId?.name || 'N/A'}</span></span>
                <span><strong>Phone:</strong> <span style={{ color: 'white' }}>{activeBooking.userId?.phone || 'N/A'}</span></span>
                <span style={{ gridColumn: '1 / -1' }}><strong>Email:</strong> <span style={{ color: 'white' }}>{activeBooking.userId?.email || 'N/A'}</span></span>
              </div>
            </div>

            {/* Trip details */}
            <div>
              <Title level={5} style={{ color: 'white', margin: '0 0 8px 0' }}>Trip Schedule & Route</Title>
              <div style={{ background: '#161922', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span><strong>Route:</strong> <span style={{ color: 'white' }}>{activeBooking.tripId?.routeId?.name || 'N/A'}</span></span>
                <span><strong>Departure:</strong> <span style={{ color: 'white' }}>{activeBooking.tripId?.departureTime ? new Date(activeBooking.tripId.departureTime).toLocaleString() : 'N/A'}</span></span>
                <span><strong>Seats:</strong> <span style={{ color: 'white' }}>{activeBooking.seatNumbers?.join(', ') || 'N/A'}</span></span>
                <span><strong>Pickup Stop:</strong> <span style={{ color: 'white' }}>{activeBooking.pickupCheckpoint?.name || 'N/A'}</span></span>
                <span><strong>Dropoff Stop:</strong> <span style={{ color: 'white' }}>{activeBooking.dropoffCheckpoint?.name || 'N/A'}</span></span>
              </div>
            </div>

            {/* Payment info */}
            <div>
              <Title level={5} style={{ color: 'white', margin: '0 0 8px 0' }}>Payment Information</Title>
              <div style={{ background: '#161922', padding: '12px', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <span><strong>Amount:</strong> <span style={{ color: 'white' }}>{activeBooking.amountEGP || 0} EGP</span></span>
                <span><strong>Discount:</strong> <span style={{ color: 'white' }}>{activeBooking.discountEGP ? `${activeBooking.discountEGP} EGP` : 'None'}</span></span>
                <span><strong>Promo Code:</strong> <span style={{ color: 'white' }}>{activeBooking.promoCode || 'None'}</span></span>
                <span><strong>Payment Status:</strong> <Tag color={activeBooking.paymentStatus === 'SUCCESS' ? 'green' : 'gold'}>{activeBooking.paymentStatus || 'PENDING'}</Tag></span>
                <span style={{ gridColumn: '1 / -1' }}><strong>Refund Status:</strong> <span style={{ color: 'white' }}>{activeBooking.refundStatus || 'N/A'}</span></span>
              </div>
            </div>

            {/* Check-in & Boarding Info */}
            <div>
              <Title level={5} style={{ color: 'white', margin: '0 0 8px 0' }}>Check-in & Boarding</Title>
              <div style={{ background: '#161922', padding: '12px', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <span><strong>Checked In:</strong> {activeBooking.checkedIn ? <Tag color="green">Yes</Tag> : <Tag color="default">No</Tag>}</span>
                <span><strong>Boarding Number:</strong> <span style={{ color: 'white', fontFamily: 'monospace' }}>#{activeBooking.boardingNumber || 'N/A'}</span></span>
                <span style={{ gridColumn: '1 / -1' }}><strong>QR Verification Token:</strong> <span style={{ color: 'white', fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' }}>{activeBooking.qrVerificationToken || 'N/A'}</span></span>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <Title level={5} style={{ color: 'white', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <History size={16} /> Booking Timeline
              </Title>
              <div style={{ background: '#161922', padding: '12px 16px', borderRadius: '8px' }}>
                <Timeline items={getTimelineEvents(activeBooking)} />
              </div>
            </div>

            {/* Operations Actions Panel */}
            {activeBooking.status !== 'CANCELLED' && (
              <div>
                <Title level={5} style={{ color: 'white', margin: '0 0 8px 0' }}>Operations Control Room</Title>
                <div style={{ border: '1px solid #232938', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  
                  {/* Boarding checkin */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ color: 'white', display: 'block' }}>Boarding Status</strong>
                      <span style={{ fontSize: '0.8rem' }}>Mark the passenger as boarded inside the shuttle.</span>
                    </div>
                    {activeBooking.checkedIn ? (
                      <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 'bold' }}>
                        <CheckCircle2 size={16} /> Boarded
                      </span>
                    ) : (
                      <Button type="primary" size="small" onClick={handleCheckIn} loading={checkInLoading} style={{ background: '#10b981', borderColor: '#10b981' }}>
                        Check In Passenger
                      </Button>
                    )}
                  </div>

                  <Divider style={{ margin: 0, borderColor: '#232938' }} />

                  {/* QR Ticket Verification Simulation */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <strong style={{ color: 'white' }}>Simulate QR Ticket Verification</strong>
                    <span style={{ fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Submit the verification token to validate passenger's ticket authenticity.</span>
                    <Space>
                      <Input 
                        placeholder="Verification token" 
                        value={verificationToken} 
                        onChange={e => setVerificationToken(e.target.value)}
                        style={{ background: '#171a23', borderColor: '#2e374a', color: 'white', width: '220px' }}
                      />
                      <Button icon={<ShieldCheck size={14} />} size="small" onClick={handleVerifyTicket} loading={verifyLoading}>
                        Verify Code
                      </Button>
                    </Space>
                  </div>

                  <Divider style={{ margin: 0, borderColor: '#232938' }} />

                  {/* Apply Coupon code */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <strong style={{ color: 'white' }}>Apply Manual Promo Code</strong>
                    <span style={{ fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Apply a coupon promo code to grant manual fare adjustment discount.</span>
                    <Space>
                      <Input 
                        placeholder="e.g. SAVE20" 
                        value={promoCode} 
                        onChange={e => setPromoCode(e.target.value)}
                        style={{ background: '#171a23', borderColor: '#2e374a', color: 'white', width: '220px' }}
                      />
                      <Button icon={<TicketPercent size={14} />} size="small" onClick={handleApplyPromo} loading={promoLoading}>
                        Apply Promo
                      </Button>
                    </Space>
                  </div>

                </div>
              </div>
            )}

          </div>
        )}
      </Drawer>

      {/* Booking Creator Modal */}
      <Modal
        title={<div style={{ color: 'white', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={20} color="var(--primary-color)" /> Create Manual Booking</div>}
        open={isCreateOpen}
        onCancel={() => setIsCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createLoading}
        width={700}
        destroyOnHidden={true}
        okText="Confirm Reservation"
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateSubmit} style={{ marginTop: '1.5rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Form.Item 
              name="userId" 
              label="Select Passenger" 
              rules={[{ required: true, message: 'Please select a passenger user' }]}
            >
              <Select placeholder="Choose passenger profile" showSearch optionFilterProp="label">
                {passengers.map(p => (
                  <Select.Option key={p._id} value={p._id} label={p.name}>
                    {p.name} ({p.phone})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item 
              name="tripId" 
              label="Select Trip Schedule" 
              rules={[{ required: true, message: 'Please select a scheduled trip' }]}
            >
              <Select placeholder="Choose trip schedule" onChange={handleTripChange}>
                {trips.map(t => (
                  <Select.Option key={t._id} value={t._id}>
                    {t.routeId?.name} - {new Date(t.departureTime).toLocaleString()} ({t.priceEGP} EGP)
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          {selectedTrip && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '10px' }}>
                <Form.Item 
                  name="pickupCheckpoint" 
                  label="Pickup Stop"
                  rules={[{ required: true, message: 'Select pickup location' }]}
                >
                  <Select placeholder="Select pickup stop">
                    {selectedTrip.routeId?.checkpoints?.map((cp: any, idx: number) => (
                      <Select.Option key={idx} value={cp.name}>{cp.name}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item 
                  name="dropoffCheckpoint" 
                  label="Dropoff Stop"
                  rules={[{ required: true, message: 'Select dropoff location' }]}
                >
                  <Select placeholder="Select dropoff stop">
                    {selectedTrip.routeId?.checkpoints?.map((cp: any, idx: number) => (
                      <Select.Option key={idx} value={cp.name}>{cp.name}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </div>

              {/* Seating Grid Selector */}
              <div style={{ marginTop: '15px' }}>
                <Title level={5} style={{ color: 'white', marginBottom: '12px' }}>Interactive Seat Selector Grid</Title>
                <div style={{ 
                  background: '#161922', 
                  border: '1px solid #232938', 
                  padding: '20px', 
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}>
                  {/* Minivan Cab Indicator */}
                  <div style={{ 
                    borderBottom: '3px solid var(--primary-color)', 
                    width: '180px', 
                    textAlign: 'center', 
                    paddingBottom: '6px', 
                    marginBottom: '20px', 
                    color: '#8f9cae',
                    fontSize: '11px',
                    letterSpacing: '2px'
                  }}>
                    🚌 FRONT CAB / WINDSHIELD
                  </div>

                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(4, 50px)', 
                    gap: '12px',
                    justifyContent: 'center'
                  }}>
                    {Array.from({ length: selectedTrip.vehicleId?.capacity || 14 }, (_, i) => i + 1).map(seatNum => {
                      const isOccupied = occupiedSeats.includes(seatNum);
                      const isSelected = selectedSeats.includes(seatNum);

                      let bg = '#222834';
                      let color = 'white';
                      let border = '1px solid #2d374a';
                      let cursor = 'pointer';

                      if (isOccupied) {
                        bg = '#14161a';
                        color = '#4a5568';
                        border = '1px solid #1a202c';
                        cursor = 'not-allowed';
                      } else if (isSelected) {
                        bg = 'var(--primary-color, #F5B731)';
                        color = 'black';
                        border = '1px solid var(--primary-color, #F5B731)';
                      }

                      return (
                        <button
                          key={seatNum}
                          type="button"
                          disabled={isOccupied}
                          onClick={() => toggleSeatSelection(seatNum)}
                          style={{
                            width: '45px',
                            height: '45px',
                            borderRadius: '8px',
                            background: bg,
                            color: color,
                            border: border,
                            cursor: cursor,
                            fontWeight: 'bold',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s'
                          }}
                        >
                          {seatNum}
                        </button>
                      );
                    })}
                  </div>

                  {/* Legend indicator */}
                  <div style={{ display: 'flex', gap: '20px', marginTop: '20px', fontSize: '12px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '12px', height: '12px', background: '#222834', borderRadius: '3px', border: '1px solid #2d374a' }}></span> Available
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '12px', height: '12px', background: 'var(--primary-color, #F5B731)', borderRadius: '3px' }}></span> Selected
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '12px', height: '12px', background: '#14161a', borderRadius: '3px', border: '1px solid #1a202c' }}></span> Occupied
                    </span>
                  </div>

                </div>
              </div>
            </>
          )}

        </Form>
      </Modal>
    </div>
  );
}
