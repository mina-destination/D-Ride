import { useEffect, useState } from 'react';
import { Table, Button, Drawer, Space, Tag, Input, Select, message, Popconfirm, Form, Timeline, Card, Avatar, Divider, Typography } from 'antd';
import { useAuth } from '../context/AuthContext';
import { supportAPI } from '../services/api';
import { 
  Mail, Phone, Clock, MessageSquare, ChevronRight, Inbox, Download
} from 'lucide-react';
import { exportToCSV } from '../utils/csv';

const { Title, Paragraph } = Typography;

export function SupportTicketsPage() {
  const { user: currentAdmin } = useAuth();
  
  // Data States
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  
  // Drawer States
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [replyForm] = Form.useForm();
  const [isReplying, setIsReplying] = useState(false);

  // Fetch support tickets
  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await supportAPI.getAllTickets();
      setTickets(res);
    } catch (error) {
      message.error('Failed to load support tickets');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // Filter logic for ticket list
  const filteredTickets = tickets.filter(t => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      t.subject?.toLowerCase().includes(term) ||
      t.message?.toLowerCase().includes(term) ||
      t.name?.toLowerCase().includes(term) ||
      t.email?.toLowerCase().includes(term) ||
      t.phone?.includes(term) ||
      t._id?.toLowerCase().includes(term);

    const matchesStatus = 
      statusFilter === 'ALL' || 
      (t.status || 'OPEN') === statusFilter;

    let matchesDate = true;
    if (dateFilter !== 'ALL' && t.createdAt) {
      const now = new Date();
      const created = new Date(t.createdAt);
      const diffMs = now.getTime() - created.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (dateFilter === 'TODAY') matchesDate = diffDays < 1;
      else if (dateFilter === '7DAYS') matchesDate = diffDays <= 7;
      else if (dateFilter === '30DAYS') matchesDate = diffDays <= 30;
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  // Ticket Drawer Actions
  const handleOpenDrawer = (ticket: any) => {
    const freshTicket = tickets.find(t => t._id === ticket._id);
    setSelectedTicket(freshTicket || ticket);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedTicket(null);
    replyForm.resetFields();
  };

  const handleReplyToTicket = async (values: { text: string }) => {
    if (!selectedTicket) return;
    try {
      setIsReplying(true);
      const adminName = currentAdmin?.name || 'Administrator';
      const updatedTicket = await supportAPI.replyToTicket(selectedTicket._id, values.text, adminName);
      
      setTickets((prev: any[]) => prev.map(t => t._id === selectedTicket._id ? updatedTicket : t));
      setSelectedTicket(updatedTicket);
      
      message.success('Reply submitted successfully');
      replyForm.resetFields();
    } catch (error) {
      message.error('Failed to send reply');
    } finally {
      setIsReplying(false);
    }
  };

  const handleResolveTicket = async (ticketId: string) => {
    try {
      const updatedTicket = await supportAPI.resolveTicket(ticketId);
      setTickets((prev: any[]) => prev.map(t => t._id === ticketId ? updatedTicket : t));
      if (selectedTicket?._id === ticketId) {
        setSelectedTicket(updatedTicket);
      }
      message.success('Ticket marked as resolved');
    } catch (error) {
      message.error('Failed to resolve ticket');
    }
  };

  // Columns Definitions
  const columns = [
    {
      title: 'Ticket Subject',
      key: 'subject',
      render: (_: any, record: any) => (
        <div style={{ cursor: 'pointer' }} onClick={() => handleOpenDrawer(record)}>
          <strong style={{ display: 'block', color: 'var(--text-primary)' }} className="hover-underline">{record.subject}</strong>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            ID: {record._id.substring(record._id.length - 8).toUpperCase()}
          </span>
        </div>
      )
    },
    {
      title: 'Passenger Info',
      key: 'passenger',
      render: (_: any, record: any) => (
        <div>
          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{record.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <Mail size={12} style={{ color: 'var(--text-muted)' }} />
            <span>{record.email}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            <Phone size={11} style={{ color: 'var(--text-muted)' }} />
            <code>{record.phone}</code>
          </div>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const isOpen = status === 'OPEN';
        return (
          <Tag color={isOpen ? 'gold' : 'green'} style={{ fontWeight: 'bold' }}>
            {status}
          </Tag>
        );
      }
    },
    {
      title: 'Replies',
      key: 'replies',
      render: (_: any, record: any) => (
        <Tag color="purple" style={{ fontWeight: '600' }}>
          {record.replies?.length || 0} Replies
        </Tag>
      )
    },
    {
      title: 'Submitted On',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => (
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {new Date(date).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button 
            type="link" 
            htmlType="button"
            onClick={() => handleOpenDrawer(record)}
            style={{ padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            Open Ticket <ChevronRight size={14} />
          </Button>
          {record.status === 'OPEN' && (
            <Popconfirm
              title="Mark ticket as resolved?"
              onConfirm={() => handleResolveTicket(record._id)}
              okText="Resolve"
              cancelText="Cancel"
            >
              <Button type="link" htmlType="button" style={{ color: 'var(--success)', padding: 0 }}>
                Resolve
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  const handleExport = () => {
    const headers = [
      { key: '_id', label: 'Ticket ID', transform: (val: string) => val.toUpperCase() },
      { key: 'name', label: 'User Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'subject', label: 'Subject' },
      { key: 'message', label: 'Message' },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Created At', transform: (val: string) => val ? new Date(val).toLocaleString() : '' },
    ];
    exportToCSV(filteredTickets, headers, 'support_tickets_report');
  };

  return (
    <div style={{ padding: '2rem 0' }}>
      {/* Page Header */}
      <div className="dashboard-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <Title level={2} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Inbox size={28} /> Support Tickets
          </Title>
          <Paragraph>Manage customer issues, reply to tickets, and resolve passengers support logs.</Paragraph>
        </div>
        <Space>
          <Input.Search
            placeholder="Search subject, user, ID..."
            value={searchTerm}
            onSearch={value => setSearchTerm(value)}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            value={statusFilter}
            onChange={value => setStatusFilter(value)}
            style={{ width: 150 }}
          >
            <Select.Option value="ALL">All Tickets</Select.Option>
            <Select.Option value="OPEN">Open Only</Select.Option>
            <Select.Option value="RESOLVED">Resolved Only</Select.Option>
          </Select>
          <Select
            value={dateFilter}
            onChange={value => setDateFilter(value)}
            style={{ width: 160 }}
          >
            <Select.Option value="ALL">All Time</Select.Option>
            <Select.Option value="TODAY">Today</Select.Option>
            <Select.Option value="7DAYS">Last 7 Days</Select.Option>
            <Select.Option value="30DAYS">Last 30 Days</Select.Option>
          </Select>
          <Button 
            onClick={handleExport} 
            icon={<Download size={16} />}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            Export CSV
          </Button>
        </Space>
      </div>

      <div className="card glass" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <Table
          dataSource={filteredTickets}
          columns={columns}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          style={{ padding: '0.5rem' }}
        />
      </div>

      {/* Ticket conversation detail drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={20} style={{ color: 'var(--primary-color)' }} />
            <span>Support Ticket Dialogue</span>
          </div>
        }
        placement="right"
        width={680}
        onClose={handleCloseDrawer}
        open={isDrawerOpen}
        styles={{ body: { background: 'var(--background)', color: 'var(--text-primary)', padding: '24px' } }}
      >
        {selectedTicket && (
          <div>
            {/* User metadata header card */}
            <div style={{ 
              background: 'var(--surface)', 
              border: '1px solid var(--border)', 
              borderRadius: '8px', 
              padding: '20px', 
              marginBottom: '24px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ticket Subject</span>
                  <h2 style={{ margin: '4px 0 12px 0', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedTicket.subject}
                  </h2>
                </div>
                <Tag color={selectedTicket.status === 'OPEN' ? 'gold' : 'green'} style={{ margin: 0, fontWeight: 'bold' }}>
                  {selectedTicket.status}
                </Tag>
              </div>

              <Divider style={{ margin: '12px 0' }} />

              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Passenger Name:</span>
                  <strong style={{ color: 'var(--text-secondary)' }}>{selectedTicket.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Email Address:</span>
                  <strong style={{ color: 'var(--text-secondary)' }}>{selectedTicket.email}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Phone Number:</span>
                  <code style={{ color: 'var(--text-secondary)' }}>{selectedTicket.phone}</code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Ticket ID:</span>
                  <code style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{selectedTicket._id}</code>
                </div>
              </Space>
            </div>

            {/* Conversation Log (Timeline) */}
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                <Clock size={18} style={{ color: 'var(--primary-color)' }} />
                <span>Conversation Timeline</span>
              </h3>
              
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '24px', borderRadius: '8px' }}>
                <Timeline>
                  {/* Passenger Message */}
                  <Timeline.Item color="blue" dot={<Avatar size="small" style={{ background: '#3b82f6' }}>P</Avatar>}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{selectedTicket.name} (Passenger)</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {new Date(selectedTicket.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <Card size="small" style={{ background: 'var(--background)', border: 'none', color: 'var(--text-primary)', fontSize: '13px' }}>
                      {selectedTicket.message}
                    </Card>
                  </Timeline.Item>

                  {/* Admin Replies */}
                  {selectedTicket.replies?.map((reply: any, idx: number) => (
                    <Timeline.Item key={idx} color="green" dot={<Avatar size="small" style={{ background: '#10b981' }}>A</Avatar>}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{reply.adminName || 'Admin'} (Support)</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(reply.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <Card size="small" style={{ background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.1)', color: 'var(--text-primary)', fontSize: '13px' }}>
                        {reply.text}
                      </Card>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </div>
            </div>

            {/* Resolve / Reply actions */}
            {selectedTicket.status === 'OPEN' ? (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px', borderRadius: '8px' }}>
                <Form form={replyForm} onFinish={handleReplyToTicket} layout="vertical">
                  <Form.Item
                    name="text"
                    label={<span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Compose Reply Message:</span>}
                    rules={[{ required: true, message: 'Please write a reply.' }]}
                    style={{ marginBottom: '16px' }}
                  >
                    <Input.TextArea 
                      rows={3} 
                      placeholder="Type your response to the customer..."
                      style={{ background: 'var(--background)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                    />
                  </Form.Item>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Popconfirm
                      title="Are you sure you want to resolve this ticket?"
                      onConfirm={() => handleResolveTicket(selectedTicket._id)}
                      okText="Resolve"
                      cancelText="Cancel"
                    >
                      <Button danger type="dashed">
                        Resolve Ticket
                      </Button>
                    </Popconfirm>
                    <Button type="primary" htmlType="submit" loading={isReplying} style={{ background: 'var(--primary-color)' }}>
                      Send Reply
                    </Button>
                  </div>
                </Form>
              </div>
            ) : (
              <div style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>✓ Resolved Ticket</span>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  This support dialogue was resolved by staff. No further replies can be sent.
                </p>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
