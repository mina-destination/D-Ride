import { useEffect, useState } from 'react';
import { Table, Tag, Card, Space, Select, DatePicker, Input, Button, Typography, Tabs, Form, Radio, Spin, Empty, Divider } from 'antd';
import { message } from '../utils/antdGlobal';
import { notificationsAPI } from '../services/api';
import { Bell, Send, RadioTower, MessageSquare, Mail, Smartphone, Globe, Download } from 'lucide-react';
import { exportToCSV } from '../utils/csv';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { TextArea } = Input;

export function NotificationsPage() {
  const [activeTab, setActiveTab] = useState('history');

  return (
    <div style={{ padding: '2rem 0' }}>
      <div className="dashboard-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <Title level={2} style={{ color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={28} style={{ color: 'var(--primary-color)' }} /> Notification Center
          </Title>
          <Paragraph style={{ color: 'var(--text-muted)', margin: 0 }}>View sent notifications and compose new ones to users or broadcast to all</Paragraph>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'history',
            label: <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MessageSquare size={16} /> Sent Notifications</span>,
            children: <SentNotificationsTab />,
          },
          {
            key: 'send',
            label: <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Send size={16} /> Send Notification</span>,
            children: <SendNotificationTab />,
          },
        ]}
      />
    </div>
  );
}

function SentNotificationsTab() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { page, limit: pageSize };
      if (typeFilter !== 'ALL') params.type = typeFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (dateRange?.[0]) params.startDate = dateRange[0].toISOString();
      if (dateRange?.[1]) params.endDate = dateRange[1].toISOString();
      const res = await notificationsAPI.getAll(params);
      setNotifications(Array.isArray(res) ? res : []);
      if (res.pagination) setTotal(res.pagination.total);
    } catch (err) {
      setError('Failed to load notifications');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [page, pageSize, typeFilter, statusFilter, dateRange]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter, statusFilter, dateRange]);

  const channelIcon: Record<string, React.ReactNode> = {
    SMS: <Smartphone size={12} />,
    EMAIL: <Mail size={12} />,
    WHATSAPP: <Globe size={12} />,
    IN_APP: <Bell size={12} />,
  };

  const csvHeaders = [
    { key: 'type', label: 'Type' },
    { key: 'title', label: 'Title' },
    { key: 'message', label: 'Message' },
    { key: 'channel', label: 'Channel' },
    { key: 'status', label: 'Status' },
    { key: 'user.name', label: 'Recipient', transform: (_: string, record: any) => record.user ? `${record.user.name} (${record.user.email})` : 'Broadcast' },
    { key: 'createdAt', label: 'Sent Date', transform: (val: string) => val ? new Date(val).toLocaleString() : '' },
  ];

  const handleExportCSV = () => {
    exportToCSV(notifications, csvHeaders, 'notifications_report');
  };

  const columns = [
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      sorter: (a: any, b: any) => (a.type || '').localeCompare(b.type || ''),
      render: (type: string) => {
        const map: Record<string, string> = { BOOKING_CONFIRMATION: 'blue', PAYMENT_RECEIPT: 'green', PROMOTION: 'purple', SYSTEM_ALERT: 'red', REMINDER: 'orange' };
        return <Tag color={map[type] || 'default'}>{type || 'GENERAL'}</Tag>;
      },
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      sorter: (a: any, b: any) => (a.title || '').localeCompare(b.title || ''),
      render: (text: string) => <strong style={{ color: 'var(--text-primary)' }}>{text}</strong>,
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (text: string) => (
        <Text style={{ color: 'var(--text-secondary)', maxWidth: 250 }} ellipsis={{ tooltip: text }}>
          {text}
        </Text>
      ),
    },
    {
      title: 'Channel',
      dataIndex: 'channel',
      key: 'channel',
      sorter: (a: any, b: any) => (a.channel || '').localeCompare(b.channel || ''),
      render: (channel: string) => {
        const map: Record<string, string> = { SMS: 'cyan', EMAIL: 'blue', WHATSAPP: 'green', IN_APP: 'gold' };
        return (
          <Tag color={map[channel] || 'default'} icon={channelIcon[channel]} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {channel || 'N/A'}
          </Tag>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: (a: any, b: any) => (a.status || '').localeCompare(b.status || ''),
      render: (status: string) => {
        const map: Record<string, string> = { SENT: 'green', PENDING: 'gold', FAILED: 'red', DELIVERED: 'blue' };
        return <Tag color={map[status] || 'default'} style={{ fontWeight: 'bold' }}>{status || 'SENT'}</Tag>;
      },
    },
    {
      title: 'Recipient',
      key: 'recipient',
      sorter: (a: any, b: any) => (a.user?.name || '').localeCompare(b.user?.name || ''),
      render: (_: any, record: any) => record.user ? (
        <div>
          <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{record.user.name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{record.user.email}</div>
        </div>
      ) : (
        <Tag color="purple">Broadcast</Tag>
      ),
    },
    {
      title: 'Sent Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: (a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
      render: (date: string) => (
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {date ? new Date(date).toLocaleString() : 'N/A'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="card glass" style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '1rem', marginBottom: '1rem' }}>
        <Space wrap>
          <Select value={typeFilter} onChange={setTypeFilter} style={{ width: 180 }}>
            <Select.Option value="ALL">All Types</Select.Option>
            <Select.Option value="BOOKING_CONFIRMATION">Booking Confirmation</Select.Option>
            <Select.Option value="PAYMENT_RECEIPT">Payment Receipt</Select.Option>
            <Select.Option value="PROMOTION">Promotion</Select.Option>
            <Select.Option value="SYSTEM_ALERT">System Alert</Select.Option>
            <Select.Option value="REMINDER">Reminder</Select.Option>
          </Select>
          <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 150 }}>
            <Select.Option value="ALL">All Statuses</Select.Option>
            <Select.Option value="SENT">Sent</Select.Option>
            <Select.Option value="PENDING">Pending</Select.Option>
            <Select.Option value="FAILED">Failed</Select.Option>
            <Select.Option value="DELIVERED">Delivered</Select.Option>
          </Select>
          <RangePicker
            value={dateRange as any}
            onChange={(dates) => setDateRange(dates as any)}
            style={{ width: 260 }}
            allowClear
          />
          <Button onClick={handleExportCSV} icon={<Download size={16} />} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            Export CSV
          </Button>
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
        ) : notifications.length === 0 ? (
          <Empty description="No notifications found" style={{ padding: '4rem 0' }} />
        ) : (
          <Table
            dataSource={notifications}
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

function SendNotificationTab() {
  const [mode, setMode] = useState<'user' | 'broadcast'>('user');
  const [sending, setSending] = useState(false);

  const [sendForm] = Form.useForm();
  const [broadcastForm] = Form.useForm();

  const handleSend = async (values: any) => {
    try {
      setSending(true);
      await notificationsAPI.send({
        userId: values.userId,
        title: values.title,
        message: values.message,
        channel: values.channel,
      });
      message.success('Notification sent successfully');
      sendForm.resetFields();
    } catch (err) {
      message.error('Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const handleBroadcast = async (values: any) => {
    try {
      setSending(true);
      await notificationsAPI.broadcast({
        title: values.title,
        message: values.message,
        channel: values.channel,
        role: values.role,
      });
      message.success('Broadcast sent successfully');
      broadcastForm.resetFields();
    } catch (err) {
      message.error('Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <Card
        className="glass"
        style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '16px' }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Radio.Group
            value={mode}
            onChange={e => setMode(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            size="large"
          >
            <Radio.Button value="user"><Send size={14} style={{ marginRight: 6 }} />Send to User</Radio.Button>
            <Radio.Button value="broadcast"><RadioTower size={14} style={{ marginRight: 6 }} />Broadcast to All</Radio.Button>
          </Radio.Group>

          <Divider style={{ borderColor: 'var(--border)', margin: '8px 0' }} />

          {mode === 'user' ? (
            <Form form={sendForm} layout="vertical" onFinish={handleSend}>
              <Form.Item
                name="userId"
                label={<span style={{ color: 'var(--text-muted)' }}>User ID</span>}
                rules={[{ required: true, message: 'Please enter a user ID' }]}
              >
                <Input placeholder="Enter user ID (e.g., 60f7b...)" style={{ background: 'var(--background)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />
              </Form.Item>
              <Form.Item
                name="title"
                label={<span style={{ color: 'var(--text-muted)' }}>Title</span>}
                rules={[{ required: true, message: 'Please enter a title' }]}
              >
                <Input placeholder="Notification title" style={{ background: 'var(--background)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />
              </Form.Item>
              <Form.Item
                name="message"
                label={<span style={{ color: 'var(--text-muted)' }}>Message</span>}
                rules={[{ required: true, message: 'Please enter a message' }]}
              >
                <TextArea rows={4} placeholder="Write your notification message..." style={{ background: 'var(--background)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />
              </Form.Item>
              <Form.Item
                name="channel"
                label={<span style={{ color: 'var(--text-muted)' }}>Channel</span>}
                rules={[{ required: true, message: 'Please select a channel' }]}
                initialValue="IN_APP"
              >
                <Select style={{ width: 200 }}>
                  <Select.Option value="SMS">SMS</Select.Option>
                  <Select.Option value="EMAIL">Email</Select.Option>
                  <Select.Option value="WHATSAPP">WhatsApp</Select.Option>
                  <Select.Option value="IN_APP">In-App</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={sending} style={{ background: 'var(--primary-color)', color: 'black', fontWeight: 'bold' }}>
                  <Send size={16} style={{ marginRight: 6 }} /> Send Notification
                </Button>
              </Form.Item>
            </Form>
          ) : (
            <Form form={broadcastForm} layout="vertical" onFinish={handleBroadcast}>
              <Form.Item
                name="title"
                label={<span style={{ color: 'var(--text-muted)' }}>Title</span>}
                rules={[{ required: true, message: 'Please enter a title' }]}
              >
                <Input placeholder="Broadcast title" style={{ background: 'var(--background)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />
              </Form.Item>
              <Form.Item
                name="message"
                label={<span style={{ color: 'var(--text-muted)' }}>Message</span>}
                rules={[{ required: true, message: 'Please enter a message' }]}
              >
                <TextArea rows={4} placeholder="Write your broadcast message..." style={{ background: 'var(--background)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />
              </Form.Item>
              <Form.Item
                name="channel"
                label={<span style={{ color: 'var(--text-muted)' }}>Channel</span>}
                rules={[{ required: true, message: 'Please select a channel' }]}
                initialValue="IN_APP"
              >
                <Select style={{ width: 200 }}>
                  <Select.Option value="SMS">SMS</Select.Option>
                  <Select.Option value="EMAIL">Email</Select.Option>
                  <Select.Option value="WHATSAPP">WhatsApp</Select.Option>
                  <Select.Option value="IN_APP">In-App</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="role"
                label={<span style={{ color: 'var(--text-muted)' }}>Target Role</span>}
                initialValue="ALL"
              >
                <Select style={{ width: 200 }}>
                  <Select.Option value="ALL">All Users</Select.Option>
                  <Select.Option value="PASSENGER">Passengers</Select.Option>
                  <Select.Option value="DRIVER">Drivers</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={sending} style={{ background: 'var(--primary-color)', color: 'black', fontWeight: 'bold' }}>
                  <RadioTower size={16} style={{ marginRight: 6 }} /> Send Broadcast
                </Button>
              </Form.Item>
            </Form>
          )}
        </Space>
      </Card>
    </div>
  );
}
