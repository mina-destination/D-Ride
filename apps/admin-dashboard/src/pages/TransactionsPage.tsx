import { useEffect, useState } from 'react';
import { Table, Tag, Card, Space, Select, DatePicker, Input, Button, Statistic, Row, Col, Typography, Tooltip, Drawer, Descriptions, Spin, Empty } from 'antd';
import { transactionsAPI } from '../services/api';
import { CreditCard, TrendingUp, Target, XCircle, Eye, ChevronRight } from 'lucide-react';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [userIdFilter, setUserIdFilter] = useState('');
  const [searchText, setSearchText] = useState('');

  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (paymentMethodFilter !== 'ALL') params.paymentMethod = paymentMethodFilter;
      if (dateRange?.[0]) params.startDate = dateRange[0].toISOString();
      if (dateRange?.[1]) params.endDate = dateRange[1].toISOString();
      if (userIdFilter) params.userId = userIdFilter;
      const res = await transactionsAPI.getAll(params);
      setTransactions(Array.isArray(res) ? res : []);
    } catch (err) {
      setError('Failed to load transactions');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [statusFilter, paymentMethodFilter, dateRange, userIdFilter]);

  const totalRevenue = transactions
    .filter(t => t.status === 'SUCCESS')
    .reduce((sum, t) => sum + (t.amountEGP || 0), 0);

  const successCount = transactions.filter(t => t.status === 'SUCCESS').length;
  const failedCount = transactions.filter(t => t.status === 'FAILED').length;
  const totalCount = transactions.length;

  const filteredTransactions = transactions.filter(t => {
    const term = searchText.toLowerCase();
    if (!term) return true;
    return (
      (t.user?.name?.toLowerCase().includes(term)) ||
      (t.user?.email?.toLowerCase().includes(term)) ||
      (t._id?.toLowerCase().includes(term)) ||
      (t.paymobOrderId?.toString().includes(term)) ||
      (t.bookingId?.toLowerCase().includes(term))
    );
  });

  const handleRowClick = (record: any) => {
    setSelectedTransaction(record);
    setDrawerOpen(true);
  };

  const formatAmount = (val: number) =>
    <strong style={{ color: 'var(--primary-color)', fontSize: '15px' }}>{val?.toLocaleString() || 0} EGP</strong>;

  const columns = [
    {
      title: 'ID',
      dataIndex: '_id',
      key: '_id',
      width: 100,
      sorter: (a: any, b: any) => (a._id || '').localeCompare(b._id || ''),
      render: (id: string) => (
        <Tooltip title={id}>
          <code style={{ color: 'var(--text-muted)', fontSize: '11px' }}>#{id?.substring(id.length - 8).toUpperCase()}</code>
        </Tooltip>
      ),
    },
    {
      title: 'User',
      key: 'user',
      sorter: (a: any, b: any) => (a.user?.name || '').localeCompare(b.user?.name || ''),
      render: (_: any, record: any) => (
        <div>
          <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{record.user?.name || 'Unknown'}</strong>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{record.user?.email || ''}</span>
        </div>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amountEGP',
      key: 'amountEGP',
      sorter: (a: any, b: any) => (a.amountEGP || 0) - (b.amountEGP || 0),
      render: (val: number) => formatAmount(val),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: (a: any, b: any) => (a.status || '').localeCompare(b.status || ''),
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          SUCCESS: 'green',
          PENDING: 'gold',
          FAILED: 'red',
          REFUNDED: 'purple',
        };
        return <Tag color={colorMap[status] || 'default'} style={{ fontWeight: 'bold' }}>{status || 'PENDING'}</Tag>;
      },
    },
    {
      title: 'Payment Method',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      sorter: (a: any, b: any) => (a.paymentMethod || '').localeCompare(b.paymentMethod || ''),
      render: (method: string) => {
        const colorMap: Record<string, string> = {
          CARD: 'blue',
          WALLET: 'cyan',
          CASH: 'orange',
        };
        return <Tag color={colorMap[method] || 'default'}>{method || 'N/A'}</Tag>;
      },
    },
    {
      title: 'Booking ID',
      dataIndex: 'bookingId',
      key: 'bookingId',
      sorter: (a: any, b: any) => (a.bookingId || '').localeCompare(b.bookingId || ''),
      render: (id: string) => id ? <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{id.substring(0, 8)}...</code> : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      title: 'Paymob Order ID',
      dataIndex: 'paymobOrderId',
      key: 'paymobOrderId',
      sorter: (a: any, b: any) => (a.paymobOrderId || 0) - (b.paymobOrderId || 0),
      render: (val: number) => val ? <strong style={{ color: 'var(--primary-color)' }}>#{val}</strong> : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: (a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
      render: (date: string) => (
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {date ? new Date(date).toLocaleString() : 'N/A'}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button type="link" onClick={() => handleRowClick(record)} style={{ padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
          View <ChevronRight size={14} />
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '2rem 0' }}>
      <div className="dashboard-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <Title level={2} style={{ color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={28} /> Transaction Log
          </Title>
          <Paragraph style={{ color: 'var(--text-muted)', margin: 0 }}>Monitor all payment transactions, payment methods, and gateway statuses</Paragraph>
        </div>
      </div>

      <Row gutter={24} style={{ marginBottom: '2rem' }}>
        <Col xs={24} md={6}>
          <Card variant="borderless" className="kpi-card glass" style={{ padding: '10px' }}>
            <Statistic
              title={<span style={{ color: 'var(--text-muted)' }}>Total Revenue</span>}
              value={totalRevenue}
              precision={2}
              suffix=" EGP"
              valueStyle={{ color: 'var(--primary-color)', fontWeight: 800 }}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card variant="borderless" className="kpi-card glass" style={{ padding: '10px' }}>
            <Statistic
              title={<span style={{ color: 'var(--text-muted)' }}>Total Transactions</span>}
              value={totalCount}
              valueStyle={{ color: '#3b82f6', fontWeight: 800 }}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card variant="borderless" className="kpi-card glass" style={{ padding: '10px' }}>
            <Statistic
              title={<span style={{ color: 'var(--text-muted)' }}>Success Rate</span>}
              value={totalCount ? ((successCount / totalCount) * 100).toFixed(1) : 0}
              suffix="%"
              valueStyle={{ color: '#52c41a', fontWeight: 800 }}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card variant="borderless" className="kpi-card glass" style={{ padding: '10px' }}>
            <Statistic
              title={<span style={{ color: 'var(--text-muted)' }}>Failed Count</span>}
              value={failedCount}
              valueStyle={{ color: '#ff4d4f', fontWeight: 800 }}
            />
          </Card>
        </Col>
      </Row>

      <div className="card glass" style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '1rem', marginBottom: '1rem' }}>
        <Space wrap style={{ width: '100%' }}>
          <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 150 }}>
            <Select.Option value="ALL">All Statuses</Select.Option>
            <Select.Option value="PENDING">Pending</Select.Option>
            <Select.Option value="SUCCESS">Success</Select.Option>
            <Select.Option value="FAILED">Failed</Select.Option>
            <Select.Option value="REFUNDED">Refunded</Select.Option>
          </Select>
          <Select value={paymentMethodFilter} onChange={setPaymentMethodFilter} style={{ width: 160 }}>
            <Select.Option value="ALL">All Methods</Select.Option>
            <Select.Option value="CARD">Card</Select.Option>
            <Select.Option value="WALLET">Wallet</Select.Option>
            <Select.Option value="CASH">Cash</Select.Option>
          </Select>
          <RangePicker
            value={dateRange as any}
            onChange={(dates) => setDateRange(dates as any)}
            style={{ width: 260 }}
            allowClear
          />
          <Input
            placeholder="Filter by User ID"
            value={userIdFilter}
            onChange={e => setUserIdFilter(e.target.value)}
            style={{ width: 180 }}
            allowClear
          />
          <Input.Search
            placeholder="Search name, email, ID..."
            value={searchText}
            onSearch={value => setSearchText(value)}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
        </Space>
      </div>

      {error && (
        <div className="card glass" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1rem', color: 'var(--danger)' }}>
          <Text type="danger">{error}</Text>
        </div>
      )}

      <div className="card glass" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem 0' }}>
            <Spin size="large" />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <Empty description="No transactions found" style={{ padding: '4rem 0' }} />
        ) : (
          <Table
            dataSource={filteredTransactions}
            columns={columns}
            rowKey="_id"
            pagination={{ pageSize: 10, showSizeChanger: true }}
            style={{ padding: '0.5rem' }}
          />
        )}
      </div>

      <Drawer
        title={
          <Space>
            <Eye size={18} style={{ color: 'var(--primary-color)' }} />
            <span>Transaction Details</span>
          </Space>
        }
        placement="right"
        width={580}
        onClose={() => { setDrawerOpen(false); setSelectedTransaction(null); }}
        open={drawerOpen}
        styles={{ body: { background: 'var(--background)', color: 'var(--text-primary)' } }}
      >
        {selectedTransaction && (
          <Descriptions column={1} bordered size="small" colon={false}
            styles={{
              label: { color: 'var(--text-muted)', background: 'var(--surface)' },
              content: { color: 'var(--text-primary)', background: 'var(--background)' },
            }}
          >
            <Descriptions.Item label="Transaction ID">{selectedTransaction._id}</Descriptions.Item>
            <Descriptions.Item label="User">
              {selectedTransaction.user?.name || 'Unknown'} ({selectedTransaction.user?.email || 'N/A'})
            </Descriptions.Item>
            <Descriptions.Item label="Amount">{selectedTransaction.amountEGP?.toLocaleString() || 0} EGP</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={selectedTransaction.status === 'SUCCESS' ? 'green' : selectedTransaction.status === 'FAILED' ? 'red' : 'gold'}>
                {selectedTransaction.status || 'PENDING'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Payment Method">{selectedTransaction.paymentMethod || 'N/A'}</Descriptions.Item>
            <Descriptions.Item label="Booking ID">{selectedTransaction.bookingId || '—'}</Descriptions.Item>
            <Descriptions.Item label="Paymob Order ID">{selectedTransaction.paymobOrderId || '—'}</Descriptions.Item>
            <Descriptions.Item label="Date">
              {selectedTransaction.createdAt ? new Date(selectedTransaction.createdAt).toLocaleString() : 'N/A'}
            </Descriptions.Item>
            {selectedTransaction.rawResponse && (
              <Descriptions.Item label="Raw Response">
                <pre style={{
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  background: 'var(--surface)',
                  padding: '8px',
                  borderRadius: '4px',
                  maxHeight: '200px',
                  overflow: 'auto',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {typeof selectedTransaction.rawResponse === 'string'
                    ? selectedTransaction.rawResponse
                    : JSON.stringify(selectedTransaction.rawResponse, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
}
