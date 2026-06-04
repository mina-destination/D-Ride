import { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Typography, Tooltip, Input, Select, Card, DatePicker } from 'antd';
import { Popconfirm } from '../components/Popconfirm';
import { message } from '../utils/antdGlobal';
import { bookingsAPI } from '../services/api';
import { Ticket, Download, XCircle } from 'lucide-react';
import { exportToCSV } from '../utils/csv';
import dayjs from 'dayjs';

const { Title, Paragraph } = Typography;

export function BookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);
  
  // Row selection & bulk states
  const [selectedRowKeys, setSelectedRowKeys] = useState<any[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

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

  const handleExportData = (dataToExport: any[]) => {
    const headers = [
      { key: '_id', label: 'Booking ID', transform: (val: string) => val.toUpperCase() },
      { key: 'userId.name', label: 'Passenger Name' },
      { key: 'userId.email', label: 'Passenger Email' },
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
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{record.userId?.email || 'N/A'}</span>
        </div>
      ),
    },
    {
      title: 'Route',
      key: 'route',
      sorter: (a: any, b: any) => (a.tripId?.routeId?.name || '').localeCompare(b.tripId?.routeId?.name || ''),
      render: (_: any, record: any) => (
        <strong>{record.tripId?.routeId?.name || 'N/A'}</strong>
      ),
    },
    {
      title: 'Departure Time',
      key: 'departureTime',
      sorter: (a: any, b: any) => new Date(a.tripId?.departureTime || 0).getTime() - new Date(b.tripId?.departureTime || 0).getTime(),
      render: (_: any, record: any) => {
        if (!record.tripId?.departureTime) return 'N/A';
        return new Date(record.tripId.departureTime).toLocaleString();
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
        if (s === 'CONFIRMED' || s === 'SUCCESS') color = 'green';
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
      render: (_: any, record: any) => (
        <Space>
          {record.status !== 'CANCELLED' ? (
            <Tooltip title="Cancel this seat booking">
              <Popconfirm
                title="Cancel this booking?"
                description="Are you sure you want to cancel this booking?"
                onConfirm={() => handleCancel(record._id)}
                okText="Yes, Cancel"
                cancelText="No"
              >
                <Button type="link" danger>
                  Cancel Booking
                </Button>
              </Popconfirm>
            </Tooltip>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No Actions</span>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '2rem 0' }}>
      <div className="dashboard-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <Title level={2} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Ticket size={28} /> Bookings Management
          </Title>
          <Paragraph>View passenger seat reservations and assign route statuses</Paragraph>
        </div>
        <Space>
          <Input.Search
            placeholder="Search passenger, route, ID..."
            value={searchTerm}
            onSearch={value => setSearchTerm(value)}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <DatePicker
            placeholder="Filter by Departure Date"
            value={selectedDate}
            onChange={value => setSelectedDate(value)}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            value={statusFilter}
            onChange={value => setStatusFilter(value)}
            style={{ width: 150 }}
          >
            <Select.Option value="ALL">All Bookings</Select.Option>
            <Select.Option value="CONFIRMED">Confirmed</Select.Option>
            <Select.Option value="PENDING">Pending</Select.Option>
            <Select.Option value="CANCELLED">Cancelled</Select.Option>
          </Select>
          <Select
            value={paymentStatusFilter}
            onChange={value => setPaymentStatusFilter(value)}
            style={{ width: 160 }}
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
            style={{ fontWeight: 'bold' }}
          >
            {isSelectionMode ? "Exit Selection" : "Select Bookings"}
          </Button>
          <Button 
            onClick={handleExport} 
            icon={<Download size={16} />}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            Export CSV
          </Button>
        </Space>
      </div>

      {selectedRowKeys.length > 0 && (
        <Card 
          style={{ 
            marginBottom: '1rem', 
            background: 'var(--surface-hover)', 
            border: '1px solid var(--border)',
            borderRadius: '12px' 
          }}
          size="small"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '13px' }}>
              Selected {selectedRowKeys.length} booking{selectedRowKeys.length > 1 ? 's' : ''}
            </span>
            <Space>
              <Button 
                onClick={handleExportSelected} 
                icon={<Download size={14} />}
                size="small"
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Export Selected CSV
              </Button>
              <Popconfirm
                title={`Are you sure you want to cancel the ${selectedRowKeys.length} selected bookings?`}
                onConfirm={handleBulkCancel}
                okText="Yes, Cancel"
                cancelText="No"
              >
                <Button 
                  type="primary" 
                  danger 
                  size="small" 
                  icon={<XCircle size={14} />}
                  loading={bulkLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  Cancel Selected
                </Button>
              </Popconfirm>
              <Button 
                type="text" 
                size="small" 
                onClick={() => setSelectedRowKeys([])}
              >
                Deselect All
              </Button>
            </Space>
          </div>
        </Card>
      )}

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
        style={{ marginTop: '1rem' }}
      />
    </div>
  );
}
