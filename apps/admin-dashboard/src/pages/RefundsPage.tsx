import { useState, useEffect } from 'react';
import { Table, Tag, Button, Space, Card, Typography, Row, Col, Statistic, Tooltip, Input, Select, DatePicker } from 'antd';
import { Undo2, AlertTriangle, CheckCircle, XCircle, Clock, User, MapPin, Calendar } from 'lucide-react';
import { bookingsAPI } from '../services/api';
import { useConfirm } from '../context/ConfirmContext';
import dayjs from 'dayjs';

const { Text } = Typography;

export function RefundsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'PROCESSED' | 'ALL'>('PENDING');
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);
  const confirm = useConfirm();

  const loadRefundRequests = async () => {
    setLoading(true);
    try {
      const data = await bookingsAPI.getAll();
      setBookings(data || []);
    } catch (err) {
      console.error('Failed to load refund requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRefundRequests();
  }, []);

  const getPolicyDetails = (booking: any) => {
    if (!booking || !booking.tripId) {
      return { percentage: 0, reason: 'N/A', action: 'REJECT' as const };
    }
    const cancellationTime = new Date(booking.updatedAt);
    const departureTime = new Date(booking.tripId.departureTime);
    const diffMs = departureTime.getTime() - cancellationTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours >= 48) {
      return {
        percentage: 100,
        reason: 'Cancelled 48+ hours before departure',
        action: 'FULL' as const,
      };
    } else if (diffHours >= 24) {
      return {
        percentage: 50,
        reason: 'Cancelled 24-48 hours before departure',
        action: 'HALF' as const,
      };
    } else {
      return {
        percentage: 0,
        reason: 'Cancelled less than 24 hours before departure',
        action: 'REJECT' as const,
      };
    }
  };

  const handleProcessRefund = async (bookingId: string, action: 'FULL' | 'HALF' | 'REJECT') => {
    try {
      await bookingsAPI.refund(bookingId, action);
      loadRefundRequests();
    } catch (err) {
      console.error('Failed to process refund:', err);
    }
  };

  const showConfirmCard = (booking: any, action: 'FULL' | 'HALF' | 'REJECT') => {
    const passengerName = booking.userId?.name || 'Passenger';
    const amount = booking.amountEGP || 0;
    const refundAmount = action === 'FULL' ? amount : action === 'HALF' ? amount * 0.5 : 0;
    
    let title: string;
    let description: string;
    let danger: boolean;

    if (action === 'FULL') {
      title = 'Approve 100% Refund';
      description = `Are you sure you want to approve a full refund of EGP ${amount.toFixed(2)} for ${passengerName}? This documents the action; the Paymob operations team will execute the refund.`;
      danger = false;
    } else if (action === 'HALF') {
      title = 'Approve 50% Refund';
      description = `Are you sure you want to approve a partial refund of EGP ${refundAmount.toFixed(2)} (50%) for ${passengerName}? This documents the action; the Paymob operations team will execute the refund.`;
      danger = false;
    } else {
      title = 'Reject Refund Request';
      description = `Are you sure you want to reject the refund request for ${passengerName}? This documents the rejection, and the passenger will receive a rejection notification.`;
      danger = true;
    }

    confirm({
      title,
      description,
      confirmText: action === 'REJECT' ? 'Yes, Reject' : 'Yes, Approve',
      cancelText: 'Cancel',
      danger,
      onConfirm: () => handleProcessRefund(booking._id, action),
    });
  };

  // Filter bookings to refund requests:
  // Pending requests: status is CANCELLED and paymentStatus is SUCCESS
  // Processed requests: paymentStatus is REFUNDED or (status is CANCELLED and paymentStatus is FAILED)
  const refundRequests = bookings.filter((b) => {
    if (b.status !== 'CANCELLED' && b.status !== 'REFUNDED') return false;
    
    const isPending = b.status === 'CANCELLED' && b.paymentStatus === 'SUCCESS';
    const isProcessed = b.status === 'REFUNDED' || b.paymentStatus === 'REFUNDED' || (b.status === 'CANCELLED' && b.paymentStatus === 'FAILED');

    if (statusFilter === 'PENDING') return isPending;
    if (statusFilter === 'PROCESSED') return isProcessed;
    return isPending || isProcessed;
  });

  // Search filter
  const filteredRequests = refundRequests.filter((b) => {
    const term = searchTerm.toLowerCase();
    const passengerName = b.userId?.name?.toLowerCase() || '';
    const passengerPhone = b.userId?.phone || '';
    const routeName = b.tripId?.routeId?.name?.toLowerCase() || '';
    
    const matchesSearch = passengerName.includes(term) || passengerPhone.includes(term) || routeName.includes(term);
    const matchesDate = !selectedDate || (b.tripId?.departureTime && dayjs(b.tripId.departureTime).isSame(selectedDate, 'day'));
    
    return matchesSearch && matchesDate;
  });

  // Statistics
  const pendingCount = bookings.filter(b => b.status === 'CANCELLED' && b.paymentStatus === 'SUCCESS').length;
  const totalProcessedAmount = bookings
    .filter(b => b.paymentStatus === 'REFUNDED')
    .reduce((sum, b) => {
      // Find the refund transaction negative amount to get true refunded cash
      // Or we can just calculate it based on 100% or 50% refund status. For simplicity, we get sum of amountEGP
      return sum + (b.amountEGP || 0);
    }, 0);

  const columns = [
    {
      title: 'Passenger Details',
      key: 'passenger',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={1}>
          <Text strong style={{ color: 'var(--text-primary)' }}><User size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> {record.userId?.name || 'N/A'}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>{record.userId?.phone || 'N/A'}</Text>
          <Text type="secondary" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{record.userId?.email || 'N/A'}</Text>
        </Space>
      ),
    },
    {
      title: 'Trip & Booking Info',
      key: 'trip',
      render: (_: any, record: any) => {
        const routeName = record.tripId?.routeId?.name || 'N/A';
        const departureTime = record.tripId?.departureTime 
          ? new Date(record.tripId.departureTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : 'N/A';
        return (
          <Space direction="vertical" size={1}>
            <Text strong style={{ color: 'var(--text-primary)' }}><MapPin size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> {routeName}</Text>
            <Text type="secondary" style={{ fontSize: '12px' }}><Calendar size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> {departureTime}</Text>
            <Text type="secondary" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Seat: {record.seatNumbers?.join(', ') || 'N/A'} (EGP {record.amountEGP})</Text>
          </Space>
        );
      },
    },
    {
      title: 'Paymob Details',
      key: 'paymob',
      render: (_: any, record: any) => {
        return (
          <Space direction="vertical" size={1}>
            {record.paymobOrderId && (
              <Text style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Order ID: <Text copyable={{ text: record.paymobOrderId.toString() }} style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{record.paymobOrderId}</Text>
              </Text>
            )}
            {record.paymobPaymentId && (
              <Text style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Transaction ID: <Text copyable={{ text: record.paymobPaymentId }} style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{record.paymobPaymentId}</Text>
              </Text>
            )}
            {!record.paymobOrderId && !record.paymobPaymentId && (
              <Text type="secondary" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>— (Mock Payment)</Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Cancellation Time',
      key: 'cancellation',
      render: (_: any, record: any) => {
        const cancelTime = new Date(record.updatedAt).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        return (
          <Space direction="vertical" size={1}>
            <Text style={{ color: 'var(--text-primary)' }}>{cancelTime}</Text>
            <Text type="secondary" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              <Clock size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              {record.tripId ? `${Math.max(0, Math.round((new Date(record.tripId.departureTime).getTime() - new Date(record.updatedAt).getTime()) / (1000 * 60 * 60)))}h before trip` : ''}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'System Policy Suggestion',
      key: 'policy',
      render: (_: any, record: any) => {
        // If already processed
        if (record.status === 'REFUNDED' || record.paymentStatus === 'REFUNDED') {
          return <Tag color="green" icon={<CheckCircle size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />}>REFUNDED</Tag>;
        }
        if (record.paymentStatus === 'FAILED') {
          return <Tag color="red" icon={<XCircle size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />}>REJECTED</Tag>;
        }

        const policy = getPolicyDetails(record);
        if (policy.percentage === 100) {
          return (
            <Space direction="vertical" size={1}>
              <span className="refund-badge-policy full">100% Refund Recommended</span>
              <Text type="secondary" style={{ fontSize: '11px' }}>{policy.reason}</Text>
            </Space>
          );
        } else if (policy.percentage === 50) {
          return (
            <Space direction="vertical" size={1}>
              <span className="refund-badge-policy half">50% Refund Recommended</span>
              <Text type="secondary" style={{ fontSize: '11px' }}>{policy.reason}</Text>
            </Space>
          );
        } else {
          return (
            <Space direction="vertical" size={1}>
              <span className="refund-badge-policy reject">Reject Refund Recommended</span>
              <Text type="secondary" style={{ fontSize: '11px' }}>{policy.reason}</Text>
            </Space>
          );
        }
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => {
        const isPending = record.status === 'CANCELLED' && record.paymentStatus === 'SUCCESS';
        if (!isPending) {
          return <Text type="secondary" style={{ fontSize: '13px' }}>Processed</Text>;
        }

        const policy = getPolicyDetails(record);

        return (
          <Space size="middle">
            <Tooltip title="Document 100% full refund (manual execution on Paymob)">
              <Button 
                type={policy.action === 'FULL' ? 'primary' : 'default'} 
                size="small" 
                onClick={() => showConfirmCard(record, 'FULL')}
                style={{ 
                  borderColor: policy.action === 'FULL' ? undefined : '#10b981', 
                  color: policy.action === 'FULL' ? undefined : '#10b981',
                  background: policy.action === 'FULL' ? '#10b981' : undefined
                }}
              >
                100% Refund
              </Button>
            </Tooltip>
            
            <Tooltip title="Document 50% partial refund (manual execution on Paymob)">
              <Button 
                type={policy.action === 'HALF' ? 'primary' : 'default'} 
                size="small" 
                onClick={() => showConfirmCard(record, 'HALF')}
                style={{ 
                  borderColor: policy.action === 'HALF' ? undefined : '#f5b731', 
                  color: policy.action === 'HALF' ? undefined : '#f5b731',
                  background: policy.action === 'HALF' ? '#f5b731' : undefined
                }}
              >
                50% Refund
              </Button>
            </Tooltip>

            <Tooltip title="Reject refund request">
              <Button 
                danger 
                type={policy.action === 'REJECT' ? 'primary' : 'default'} 
                size="small" 
                onClick={() => showConfirmCard(record, 'REJECT')}
              >
                Reject
              </Button>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '2rem 0' }}>
      <div className="dashboard-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Undo2 size={28} style={{ color: 'var(--primary)' }} /> Refund Requests Management
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Process cancelled bookings, apply refund policies, and notify passengers</p>
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: '2rem' }}>
        <Col xs={24} sm={12} md={8}>
          <Card className="refund-card-glass">
            <Statistic 
              title={<span style={{ color: 'var(--text-secondary)' }}>Pending Requests</span>}
              value={pendingCount} 
              valueStyle={{ color: 'var(--primary)', fontWeight: 800 }}
              prefix={<Clock size={20} style={{ verticalAlign: 'middle', marginRight: '6px' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card className="refund-card-glass">
            <Statistic 
              title={<span style={{ color: 'var(--text-secondary)' }}>Refunded Volume</span>}
              value={totalProcessedAmount} 
              valueStyle={{ color: '#10b981', fontWeight: 800 }}
              precision={2}
              suffix=" EGP"
              prefix={<CheckCircle size={20} style={{ verticalAlign: 'middle', marginRight: '6px' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="refund-card-glass" style={{ display: 'flex', alignItems: 'center' }}>
            <Space align="start">
              <AlertTriangle size={24} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <Text strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>Refund Policy Guidelines:</Text>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                  • Cancelled &ge; 48h before trip: <strong>100% refund</strong><br />
                  • Cancelled 24h - 48h before trip: <strong>50% refund</strong><br />
                  • Cancelled &lt; 24h before trip: <strong>No refund (rejection)</strong>
                </div>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card className="refund-card-glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <Space>
            <Input.Search
              placeholder="Search by passenger or route..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: 280 }}
              allowClear
            />
            <DatePicker
              placeholder="Filter by Trip Date"
              value={selectedDate}
              onChange={setSelectedDate}
              style={{ width: 180 }}
              allowClear
            />
            <Select 
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              style={{ width: 180 }}
            >
              <Select.Option value="PENDING">Pending Action</Select.Option>
              <Select.Option value="PROCESSED">Processed History</Select.Option>
              <Select.Option value="ALL">All Requests</Select.Option>
            </Select>
          </Space>
          <Button type="default" onClick={loadRefundRequests} style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}>
            Refresh
          </Button>
        </div>

        <Table 
          columns={columns} 
          dataSource={filteredRequests} 
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          style={{ background: 'transparent' }}
          locale={{ emptyText: 'No refund requests match your filter' }}
        />
      </Card>
    </div>
  );
}
