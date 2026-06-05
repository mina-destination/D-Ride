import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Table, Button, Modal, Form, Input, Space, Select, Tag, Card } from 'antd';
import { Popconfirm } from '../components/Popconfirm';
import { message } from '../utils/antdGlobal';
import { usersAPI } from '../services/api';
import { Users, Zap, Ban, TrendingUp, Edit, Plus, Download, Trash2 } from 'lucide-react';
import { exportToCSV } from '../utils/csv';

export function PassengersPage() {
  const [passengers, setPassengers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Row selection & bulk states
  const [selectedRowKeys, setSelectedRowKeys] = useState<any[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  const location = useLocation();
  useEffect(() => {
    if (location.state && (location.state as any).searchTerm) {
      setSearchTerm((location.state as any).searchTerm);
    }
  }, [location.state]);

  const fetchPassengers = async () => {
    try {
      setLoading(true);
      const res = await usersAPI.getByRole('PASSENGER');
      setPassengers(res);
    } catch (error) {
      message.error('Failed to fetch passengers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPassengers();
  }, []);

  const handleOpenModal = (passenger?: any) => {
    if (passenger) {
      setEditingId(passenger._id);
      form.setFieldsValue({
        name: passenger.name,
        email: passenger.email,
        phone: passenger.phone,
        status: passenger.status || 'ACTIVE',
      });
    } else {
      setEditingId(null);
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    form.resetFields();
    setEditingId(null);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingId) {
        await usersAPI.update(editingId, values);
        message.success('Passenger updated successfully');
      } else {
        await usersAPI.create({ ...values, role: 'PASSENGER' });
        message.success('Passenger created successfully');
      }
      setIsModalOpen(false);
      fetchPassengers();
    } catch (error) {
      message.error((error as any).message || 'Operation failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await usersAPI.delete(id);
      message.success('Passenger deleted successfully');
      fetchPassengers();
    } catch (error) {
      message.error('Failed to delete passenger');
    }
  };

  const filteredPassengers = passengers.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      p.name?.toLowerCase().includes(term) ||
      p.email?.toLowerCase().includes(term) ||
      p.phone?.includes(term);

    const matchesStatus =
      statusFilter === 'ALL' ||
      (p.status || 'ACTIVE') === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate live statistics
  const totalCount = passengers.length;
  const activeCount = passengers.filter(p => (p.status || 'ACTIVE') === 'ACTIVE').length;
  const suspendedCount = passengers.filter(p => p.status === 'SUSPENDED').length;
  const activePercentage = totalCount > 0 ? ((activeCount / totalCount) * 100).toFixed(1) : '100.0';

  const columns = [
    {
      title: 'Passenger Info',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: any, b: any) => (a.name || '').localeCompare(b.name || ''),
      render: (text: string, record: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'black',
            fontWeight: 800,
            fontSize: '14px',
            boxShadow: '0 4px 10px rgba(245, 183, 49, 0.15)'
          }}>
            {text ? text.charAt(0).toUpperCase() : 'P'}
          </div>
          <div>
            <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{text}</strong>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>UID: {record._id.substring(record._id.length - 8)}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Email Address',
      dataIndex: 'email',
      key: 'email',
      sorter: (a: any, b: any) => (a.email || '').localeCompare(b.email || ''),
      render: (text: string) => <span style={{ color: 'var(--text-secondary)' }}>{text}</span>,
    },
    {
      title: 'Phone Number',
      dataIndex: 'phone',
      key: 'phone',
      sorter: (a: any, b: any) => (a.phone || '').localeCompare(b.phone || ''),
      render: (text: string) => <code style={{ letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>{text}</code>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: (a: any, b: any) => (a.status || 'ACTIVE').localeCompare(b.status || 'ACTIVE'),
      render: (status: string) => {
        const currentStatus = status || 'ACTIVE';
        const isCurrentActive = currentStatus === 'ACTIVE';
        return (
          <Tag 
            color={isCurrentActive ? 'green' : 'red'} 
            style={{ 
              fontWeight: 'bold', 
              borderRadius: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {currentStatus}
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button 
            type="link" 
            onClick={() => handleOpenModal(record)}
            style={{ padding: 0 }}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete Passenger Account?"
            description="Are you absolutely sure you want to remove this passenger? This action cannot be undone."
            onConfirm={() => handleDelete(record._id)}
            okText="Yes, Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" danger style={{ padding: 0 }}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleBulkStatusUpdate = async (status: string) => {
    try {
      setBulkLoading(true);
      await Promise.all(selectedRowKeys.map(id => usersAPI.update(id, { status })));
      message.success(`Successfully updated status for ${selectedRowKeys.length} passengers`);
      setSelectedRowKeys([]);
      fetchPassengers();
    } catch (error) {
      message.error('Failed to update status for some selected passengers');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    try {
      setBulkLoading(true);
      await Promise.all(selectedRowKeys.map(id => usersAPI.delete(id)));
      message.success(`Successfully deleted ${selectedRowKeys.length} passengers`);
      setSelectedRowKeys([]);
      fetchPassengers();
    } catch (error) {
      message.error('Failed to delete some selected passengers');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExportData = (dataToExport: any[]) => {
    const headers = [
      { key: '_id', label: 'Passenger ID', transform: (val: string) => val.toUpperCase() },
      { key: 'name', label: 'Passenger Name' },
      { key: 'email', label: 'Email Address' },
      { key: 'phone', label: 'Phone Number' },
      { key: 'status', label: 'Account Status', transform: (val: string) => val || 'ACTIVE' },
    ];
    exportToCSV(dataToExport, headers, 'passengers_report');
  };

  const handleExport = () => {
    handleExportData(filteredPassengers);
  };

  const handleExportSelected = () => {
    const selectedData = passengers.filter(p => selectedRowKeys.includes(p._id));
    handleExportData(selectedData);
  };

  return (
    <div style={{ padding: '2rem 0' }}>
      {/* Page Header */}
      <div className="dashboard-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={28} /> Passengers Registry</h1>
          <p>Manage and monitor customer accounts, trip privileges, and status across the D-Ride commute network</p>
        </div>
        <Space size="middle" wrap>
          <Input.Search 
            placeholder="Search name, email, phone..." 
            value={searchTerm} 
            onSearch={value => setSearchTerm(value)} 
            onChange={e => setSearchTerm(e.target.value)} 
            style={{ width: 280 }} 
            allowClear 
          />
          <Select
            value={statusFilter}
            onChange={value => setStatusFilter(value)}
            style={{ width: 160 }}
          >
            <Select.Option value="ALL">All Statuses</Select.Option>
            <Select.Option value="ACTIVE">Active</Select.Option>
            <Select.Option value="SUSPENDED">Suspended</Select.Option>
          </Select>
          <Button 
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              setSelectedRowKeys([]);
            }}
            type={isSelectionMode ? "primary" : "default"}
            ghost={isSelectionMode}
            style={{ fontWeight: 'bold', height: '40px' }}
          >
            {isSelectionMode ? "Exit Selection" : "Select Passengers"}
          </Button>
          <Button 
            onClick={handleExport} 
            icon={<Download size={16} />}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '40px' }}
          >
            Export CSV
          </Button>
          <Button 
            type="primary" 
            size="large"
            onClick={() => handleOpenModal()}
            style={{ background: 'var(--primary-color)', fontWeight: 600, height: '40px' }}
          >
            + Add Passenger
          </Button>
        </Space>
      </div>

      {/* KPI Stats Grid */}
      <div className="kpi-grid" style={{ marginBottom: '2.5rem' }}>
        <div className="kpi-card amber">
          <div className="kpi-header">
            <div className="kpi-icon amber" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={20} /></div>
            <div className="kpi-trend up">Live Registry</div>
          </div>
          <div className="kpi-value">{totalCount}</div>
          <div className="kpi-label">Total Registered Passengers</div>
        </div>

        <div className="kpi-card green">
          <div className="kpi-header">
            <div className="kpi-icon green" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Zap size={20} /></div>
            <div className="kpi-trend up">{activePercentage}%</div>
          </div>
          <div className="kpi-value">{activeCount}</div>
          <div className="kpi-label">Active Commuters</div>
        </div>

        <div className="kpi-card red">
          <div className="kpi-header">
            <div className="kpi-icon red" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ban size={20} /></div>
            <div className="kpi-trend down">Accounts</div>
          </div>
          <div className="kpi-value">{suspendedCount}</div>
          <div className="kpi-label">Suspended Privileges</div>
        </div>

        <div className="kpi-card blue">
          <div className="kpi-header">
            <div className="kpi-icon blue" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingUp size={20} /></div>
            <div className="kpi-trend up">Retention</div>
          </div>
          <div className="kpi-value">99.8%</div>
          <div className="kpi-label">Commuter Safety Rating</div>
        </div>
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
              Selected {selectedRowKeys.length} passenger{selectedRowKeys.length > 1 ? 's' : ''}
            </span>
            <Space>
              <Button 
                onClick={() => handleBulkStatusUpdate('ACTIVE')} 
                size="small"
              >
                Bulk Activate
              </Button>
              <Button 
                onClick={() => handleBulkStatusUpdate('SUSPENDED')} 
                size="small"
              >
                Bulk Suspend
              </Button>
              <Button 
                onClick={handleExportSelected} 
                icon={<Download size={14} />}
                size="small"
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Export Selected CSV
              </Button>
              <Popconfirm
                title={`Are you sure you want to delete the ${selectedRowKeys.length} selected passengers?`}
                onConfirm={handleBulkDelete}
                okText="Yes, Delete"
                cancelText="No"
              >
                <Button 
                  type="primary" 
                  danger 
                  size="small" 
                  icon={<Trash2 size={14} />}
                  loading={bulkLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  Delete Selected
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

      {/* Table Section */}
      <div className="card glass" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <Table
          rowSelection={isSelectionMode ? {
            selectedRowKeys,
            onChange: (keys: any[]) => setSelectedRowKeys(keys)
          } : undefined}
          dataSource={filteredPassengers}
          columns={columns}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          style={{ padding: '0.5rem' }}
        />
      </div>

      {/* Form Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {editingId ? <Edit size={18} /> : <Plus size={18} />}
            {editingId ? "Edit Passenger Profile" : "Add Passenger Profile"}
          </div>
        }
        open={isModalOpen}
        onCancel={handleCancel}
        onOk={() => form.submit()}
        forceRender={true}
        okText={editingId ? "Save Changes" : "Create Account"}
        okButtonProps={{ style: { background: 'var(--primary-color)', color: 'black', fontWeight: 'bold' } }}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ status: 'ACTIVE' }} style={{ marginTop: '1.5rem' }}>
          <Form.Item
            name="name"
            label="Full Name"
            rules={[{ required: true, message: 'Please enter full name' }]}
          >
            <Input placeholder="e.g. Aly Hegazy" />
          </Form.Item>
          
          <Form.Item
            name="email"
            label="Email Address"
            rules={[{ required: true, type: 'email', message: 'Please enter a valid email address' }]}
          >
            <Input placeholder="name@example.com" />
          </Form.Item>
          
          <Form.Item
            name="phone"
            label="Phone Number"
            rules={[{ required: true, message: 'Please enter phone number' }]}
          >
            <Input placeholder="e.g. 0100 123 4567" />
          </Form.Item>
          
          <Form.Item
            name="status"
            label="Account Status"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="ACTIVE">Active (Commute privileges allowed)</Select.Option>
              <Select.Option value="SUSPENDED">Suspended (Access blocked)</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
