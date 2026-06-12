import { useEffect, useState } from 'react';
import { Table, Card, Space, Select, DatePicker, Button, Statistic, Row, Col, Typography, Spin, Empty, Rate } from 'antd';
import { Popconfirm as CustomPopconfirm } from '../components/Popconfirm';
import { message } from '../utils/antdGlobal';
import { reviewsAPI } from '../services/api';
import { Star, Trash2, TrendingUp, Users, Award, MessageSquare, Download } from 'lucide-react';
import { exportToCSV } from '../utils/csv';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

export function ReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ratingFilter, setRatingFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const [stats, setStats] = useState<any>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { page, limit: pageSize };
      if (ratingFilter !== 'ALL') params.rating = parseInt(ratingFilter);
      if (dateRange?.[0]) params.startDate = dateRange[0].toISOString();
      if (dateRange?.[1]) params.endDate = dateRange[1].toISOString();
      const res = await reviewsAPI.getAll(params);
      setReviews(Array.isArray(res) ? res : []);
      if (res.pagination) setTotal(res.pagination.total);
    } catch (err) {
      setError('Failed to load reviews');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await reviewsAPI.getStats();
      setStats(res);
    } catch (err) {
      console.error('Failed to load review stats', err);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [page, pageSize, ratingFilter, dateRange]);

  useEffect(() => {
    fetchStats();
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [ratingFilter, dateRange]);

  const handleDelete = async (id: string) => {
    try {
      await reviewsAPI.delete(id);
      message.success('Review deleted successfully');
      setReviews(prev => prev.filter(r => r._id !== id));
      fetchStats();
    } catch (err) {
      message.error('Failed to delete review');
    }
  };

  const csvHeaders = [
    { key: 'user.name', label: 'User' },
    { key: 'rating', label: 'Rating' },
    { key: 'comment', label: 'Comment' },
    { key: 'trip.routeId', label: 'Trip ID' },
    { key: 'createdAt', label: 'Date', transform: (val: string) => val ? new Date(val).toLocaleString() : '' },
  ];

  const handleExportCSV = () => {
    exportToCSV(reviews, csvHeaders, 'reviews_report');
  };

  const distribution = stats?.ratingDistribution || stats?.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const maxDistCount = Math.max(...(Object.values(distribution) as number[]), 1);

  const columns = [
    {
      title: 'User',
      key: 'user',
      sorter: (a: any, b: any) => (a.user?.name || '').localeCompare(b.user?.name || ''),
      render: (_: any, record: any) => (
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>{record.user?.name || 'Unknown'}</strong>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{record.user?.email || ''}</div>
        </div>
      ),
    },
    {
      title: 'Rating',
      dataIndex: 'rating',
      key: 'rating',
      sorter: (a: any, b: any) => (a.rating || 0) - (b.rating || 0),
      render: (rating: number) => (
        <Space>
          <Rate disabled value={rating} style={{ fontSize: 14 }} />
          <Text style={{ color: 'var(--text-muted)', fontSize: 12 }}>({rating})</Text>
        </Space>
      ),
    },
    {
      title: 'Comment',
      dataIndex: 'comment',
      key: 'comment',
      ellipsis: true,
      render: (text: string) => (
        <Text style={{ color: 'var(--text-secondary)', maxWidth: 250 }} ellipsis={{ tooltip: text }}>
          {text || '—'}
        </Text>
      ),
    },
    {
      title: 'Trip',
      key: 'trip',
      sorter: (a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
      render: (_: any, record: any) => (
        <div>
          <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
            {record.trip?.routeId ? `Route #${record.trip.routeId.substring(0, 8)}` : 'N/A'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {record.createdAt ? new Date(record.createdAt).toLocaleDateString() : ''}
          </div>
        </div>
      ),
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
        <CustomPopconfirm
          title="Delete Review"
          description="Are you sure you want to permanently delete this review?"
          onConfirm={() => handleDelete(record._id)}
          okText="Delete"
          cancelText="Cancel"
        >
          <Button type="link" danger style={{ padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Trash2 size={15} /> Delete
          </Button>
        </CustomPopconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: '2rem 0' }}>
      <div className="dashboard-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <Title level={2} style={{ color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Star size={28} style={{ color: 'var(--primary-color)' }} /> Review Management
          </Title>
          <Paragraph style={{ color: 'var(--text-muted)', margin: 0 }}>Monitor customer feedback, ratings, and manage reviews across all trips</Paragraph>
        </div>
        <Space wrap>
          <Button onClick={handleExportCSV} icon={<Download size={16} />} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            Export CSV
          </Button>
        </Space>
      </div>

      <Row gutter={24} style={{ marginBottom: '2rem' }}>
        <Col xs={24} md={6}>
          <Card variant="borderless" className="kpi-card glass" style={{ padding: '10px' }}>
            <Statistic
              title={<span style={{ color: 'var(--text-muted)' }}>Total Reviews</span>}
              value={stats?.totalReviews || reviews.length || 0}
              valueStyle={{ color: 'var(--primary-color)', fontWeight: 800 }}
              prefix={<MessageSquare size={18} />}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card variant="borderless" className="kpi-card glass" style={{ padding: '10px' }}>
            <Statistic
              title={<span style={{ color: 'var(--text-muted)' }}>Average Rating</span>}
              value={stats?.averageRating || 0}
              precision={1}
              valueStyle={{ color: '#faad14', fontWeight: 800 }}
              prefix={<Star size={18} />}
              suffix={<Rate disabled value={Math.round(stats?.averageRating || 0)} style={{ fontSize: 14 }} />}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card variant="borderless" className="kpi-card glass" style={{ padding: '10px' }}>
            <Statistic
              title={<span style={{ color: 'var(--text-muted)' }}>Drivers Reviewed</span>}
              value={stats?.totalDrivers || 0}
              valueStyle={{ color: '#3b82f6', fontWeight: 800 }}
              prefix={<Users size={18} />}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card variant="borderless" className="kpi-card glass" style={{ padding: '10px' }}>
            <Statistic
              title={<span style={{ color: 'var(--text-muted)' }}>5-Star Reviews</span>}
              value={distribution[5] || 0}
              valueStyle={{ color: '#52c41a', fontWeight: 800 }}
              prefix={<Award size={18} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={24} style={{ marginBottom: '2rem' }}>
        <Col xs={24} lg={12}>
          <Card variant="borderless" className="glass" style={{ padding: '1rem', borderRadius: '16px' }}>
            <Title level={5} style={{ color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} style={{ color: 'var(--primary-color)' }} /> Rating Distribution
            </Title>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[5, 4, 3, 2, 1].map(star => {
                const count = distribution[star] || 0;
                const pct = (count / maxDistCount) * 100;
                return (
                  <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: 60, fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0 }}>
                      {star} Star{star > 1 ? 's' : ''}
                    </span>
                    <div style={{ flex: 1, height: '24px', background: 'var(--surface-hover)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: star >= 4 ? '#52c41a' : star >= 3 ? '#faad14' : '#ff4d4f',
                        borderRadius: '6px',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <span style={{ width: 40, textAlign: 'right', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 700, flexShrink: 0 }}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>
      </Row>

      <div className="card glass" style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '1rem', marginBottom: '1rem' }}>
        <Space wrap>
          <Select value={ratingFilter} onChange={setRatingFilter} style={{ width: 150 }}>
            <Select.Option value="ALL">All Ratings</Select.Option>
            <Select.Option value="5">5 Stars</Select.Option>
            <Select.Option value="4">4 Stars</Select.Option>
            <Select.Option value="3">3 Stars</Select.Option>
            <Select.Option value="2">2 Stars</Select.Option>
            <Select.Option value="1">1 Star</Select.Option>
          </Select>
          <RangePicker
            value={dateRange as any}
            onChange={(dates) => setDateRange(dates as any)}
            style={{ width: 260 }}
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
        ) : reviews.length === 0 ? (
          <Empty description="No reviews found" style={{ padding: '4rem 0' }} />
        ) : (
          <Table
            dataSource={reviews}
            columns={columns}
            rowKey="_id"
            pagination={{ current: page, pageSize, total, showSizeChanger: true, onChange: (p: number, ps: number) => { setPage(p); setPageSize(ps); } }}
            style={{ padding: '0.5rem' }}
          />
        )}
      </div>
    </div>
  );
}
