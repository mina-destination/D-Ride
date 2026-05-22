import { useEffect, useState } from 'react';
import {
  Table, Button, Drawer, Space, Tag, Input, Select, message,
  Popconfirm, Form, Card, Avatar, Divider, Modal, Row, Col,
  Typography,
} from 'antd';
import { useAuth } from '../context/AuthContext';
import { usersAPI } from '../services/api';
import {
  Shield, UserPlus, Users, ChevronRight, Trash2,
  Mail, Phone, Calendar, Edit3, Lock, Eye, EyeOff,
  Crown, ShieldCheck, ShieldAlert, Briefcase, Search,
} from 'lucide-react';

const { Title, Text, Paragraph } = Typography;

// ── Role Config ────────────────────────────────────────────
const ADMIN_ROLES = ['OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION'];

const ROLE_CONFIG: Record<string, { label: string; color: string; gradient: string; icon: any }> = {
  OWNER: {
    label: 'Owner',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    icon: Crown,
  },
  SUPER_ADMIN: {
    label: 'Super Admin',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    icon: ShieldCheck,
  },
  ADMIN: {
    label: 'Admin',
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    icon: ShieldAlert,
  },
  OPERATION: {
    label: 'Operation',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    icon: Briefcase,
  },
};

export function AdministratorsPage() {
  const { user: currentAdmin } = useAuth();

  // Data
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Detail Drawer
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────
  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const allUsers = await usersAPI.getAll();
      const adminUsers = allUsers.filter((u: any) =>
        ADMIN_ROLES.includes(u.role?.toUpperCase()),
      );
      setAdmins(adminUsers);
    } catch (error) {
      message.error('Failed to load administrators');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  // ── Filtering ──────────────────────────────────────────────
  const filteredAdmins = admins.filter((u) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      u.name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.phone?.includes(term) ||
      u._id?.toLowerCase().includes(term);

    const matchesRole =
      roleFilter === 'ALL' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  // ── Stats ──────────────────────────────────────────────────
  const totalAdmins = admins.length;
  const activeAdmins = admins.filter((u) => u.isActive !== false).length;
  const roleCounts = ADMIN_ROLES.reduce((acc, role) => {
    acc[role] = admins.filter((u) => u.role === role).length;
    return acc;
  }, {} as Record<string, number>);

  // ── Modal Actions ──────────────────────────────────────────
  const openCreateModal = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({ role: 'ADMIN', isActive: true });
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditModal = (record: any) => {
    setEditingUser(record);
    form.resetFields();
    form.setFieldsValue({
      name: record.name,
      email: record.email,
      phone: record.phone,
      role: record.role,
      isActive: record.isActive !== false,
      password: '',
    });
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    form.resetFields();
  };

  const handleSubmit = async (values: any) => {
    try {
      setSubmitting(true);

      if (editingUser) {
        // Update — only include password if provided
        const updateData: any = {
          name: values.name,
          email: values.email,
          phone: values.phone,
          role: values.role,
          isActive: values.isActive,
        };
        if (values.password && values.password.trim()) {
          updateData.password = values.password;
        }
        await usersAPI.update(editingUser._id, updateData);
        message.success('Administrator updated successfully');
      } else {
        // Create
        const createData = {
          name: values.name,
          email: values.email,
          phone: values.phone,
          password: values.password || 'DRide1234!',
          role: values.role,
          isActive: values.isActive !== false,
        };
        await usersAPI.create(createData);
        message.success('Administrator created successfully');
      }

      handleModalClose();
      fetchAdmins();
    } catch (error: any) {
      const errorMsg =
        error?.message || error?.response?.data?.message || 'Operation failed';
      message.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────
  const handleDeleteUser = async (userId: string) => {
    try {
      await usersAPI.delete(userId);
      message.success('Administrator deleted');
      fetchAdmins();
      if (selectedUser?._id === userId) {
        setIsDrawerOpen(false);
        setSelectedUser(null);
      }
    } catch (error) {
      message.error('Failed to delete administrator');
    }
  };

  // ── Toggle Status ──────────────────────────────────────────
  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await usersAPI.update(userId, { isActive: !currentStatus });
      message.success(
        `Account ${!currentStatus ? 'activated' : 'suspended'} successfully`,
      );
      fetchAdmins();
    } catch (error) {
      message.error('Failed to update status');
    }
  };

  // ── Drawer ─────────────────────────────────────────────────
  const openDrawer = (record: any) => {
    setSelectedUser(record);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedUser(null);
  };

  // ── Table Columns ──────────────────────────────────────────
  const columns = [
    {
      title: 'Administrator',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => {
        const initials = text
          ? text.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
          : 'AD';
        const config = ROLE_CONFIG[record.role] || ROLE_CONFIG.ADMIN;

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Avatar
              style={{
                background: config.gradient,
                color: 'white',
                fontWeight: 800,
                fontSize: '13px',
                boxShadow: `0 4px 12px ${config.color}40`,
              }}
            >
              {initials}
            </Avatar>
            <div
              style={{ cursor: 'pointer' }}
              onClick={() => openDrawer(record)}
            >
              <strong
                style={{ display: 'block', color: 'var(--text-primary)' }}
                className="hover-underline"
              >
                {text || 'No Name'}
              </strong>
              <span
                style={{ fontSize: '11px', color: 'var(--text-muted)' }}
              >
                ID: {record._id
                  .substring(record._id.length - 8)
                  .toUpperCase()}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (_: any, record: any) => (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
            }}
          >
            <Mail size={13} style={{ color: 'var(--text-muted)' }} />
            <span>{record.email}</span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginTop: '2px',
            }}
          >
            <Phone size={12} style={{ color: 'var(--text-muted)' }} />
            <code>{record.phone || 'N/A'}</code>
          </div>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const config = ROLE_CONFIG[role] || ROLE_CONFIG.ADMIN;
        const RoleIcon = config.icon;
        return (
          <Tag
            style={{
              color: config.color,
              background: `${config.color}15`,
              borderColor: `${config.color}30`,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2px 10px',
              borderRadius: '6px',
              fontSize: '12px',
            }}
          >
            <RoleIcon size={13} />
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean, record: any) => {
        const active = isActive !== false;
        return (
          <Popconfirm
            title="Toggle account status?"
            description={`Are you sure you want to ${active ? 'suspend' : 'activate'} this account?`}
            onConfirm={() => handleToggleStatus(record._id, active)}
            okText="Confirm"
            cancelText="Cancel"
          >
            <Tag
              color={active ? 'green' : 'red'}
              style={{
                cursor: 'pointer',
                fontWeight: 'bold',
                borderRadius: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {active ? 'Active' : 'Suspended'}
            </Tag>
          </Popconfirm>
        );
      },
    },
    {
      title: 'Joined',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => {
        if (!date) return 'N/A';
        return (
          <span
            style={{ fontSize: '13px', color: 'var(--text-secondary)' }}
          >
            {new Date(date).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => {
        const isCurrentUser = currentAdmin?._id === record._id;
        const isOwnerRecord = record.role === 'OWNER';
        const currentIsOwner = currentAdmin?.role === 'OWNER';

        return (
          <Space size="middle">
            <Button
              type="link"
              htmlType="button"
              onClick={() => openDrawer(record)}
              style={{
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Profile <ChevronRight size={14} />
            </Button>
            <Button
              type="link"
              htmlType="button"
              onClick={() => openEditModal(record)}
              style={{
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="Edit administrator"
            >
              <Edit3 size={15} />
            </Button>
            {!isCurrentUser && (!isOwnerRecord || currentIsOwner) && (
              <Popconfirm
                title="Delete this administrator?"
                description="This action cannot be undone. All data will be permanently removed."
                onConfirm={() => handleDeleteUser(record._id)}
                okText="Delete"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
              >
                <Button
                  type="link"
                  htmlType="button"
                  danger
                  style={{ padding: 0 }}
                  title="Delete administrator"
                >
                  <Trash2 size={15} />
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={{ padding: '2rem 0' }}>
      {/* ── Header ──────────────────────────────────────── */}
      <div
        className="dashboard-welcome"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <div>
          <Title
            level={2}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              margin: 0,
            }}
          >
            <Shield size={28} style={{ color: 'var(--primary)' }} />
            Administrators
          </Title>
          <Paragraph style={{ margin: 0, color: 'var(--text-secondary)' }}>
            Manage staff accounts, roles, and credentials
          </Paragraph>
        </div>
        <Button
          type="primary"
          size="large"
          htmlType="button"
          icon={<UserPlus size={18} />}
          onClick={openCreateModal}
          style={{
            background: 'var(--primary-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
            height: '44px',
            borderRadius: '10px',
            boxShadow: '0 4px 14px rgba(245, 183, 49, 0.3)',
          }}
        >
          New Administrator
        </Button>
      </div>

      {/* ── Stats Cards ─────────────────────────────────── */}
      <div className="kpi-grid" style={{ marginBottom: '2rem' }}>
        <div className="kpi-card amber">
          <div className="kpi-header">
            <div className="kpi-icon amber">
              <Users size={20} style={{ color: 'var(--primary)' }} />
            </div>
          </div>
          <div className="kpi-value">{totalAdmins}</div>
          <div className="kpi-label">Total Staff</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-header">
            <div className="kpi-icon green">
              <ShieldCheck size={20} style={{ color: 'var(--success)' }} />
            </div>
          </div>
          <div className="kpi-value">{activeAdmins}</div>
          <div className="kpi-label">Active Accounts</div>
        </div>
        <div className="kpi-card blue">
          <div className="kpi-header">
            <div className="kpi-icon blue">
              <Crown size={20} style={{ color: 'var(--info)' }} />
            </div>
          </div>
          <div className="kpi-value">{roleCounts['OWNER'] || 0}</div>
          <div className="kpi-label">Owners</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-header">
            <div className="kpi-icon red">
              <ShieldAlert
                size={20}
                style={{ color: 'var(--danger)' }}
              />
            </div>
          </div>
          <div className="kpi-value">
            {totalAdmins - activeAdmins}
          </div>
          <div className="kpi-label">Suspended</div>
        </div>
      </div>

      {/* ── Filters & Table ─────────────────────────────── */}
      <Card
        bordered={false}
        className="glass"
        style={{
          background: 'var(--surface)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
          }}
        >
          <Input
            placeholder="Search by name, email, phone, or ID..."
            prefix={<Search size={16} style={{ color: 'var(--text-muted)' }} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              minWidth: '240px',
              borderRadius: '8px',
            }}
            allowClear
          />
          <Select
            value={roleFilter}
            onChange={setRoleFilter}
            style={{ width: 180 }}
          >
            <Select.Option value="ALL">All Roles</Select.Option>
            {ADMIN_ROLES.map((role) => (
              <Select.Option key={role} value={role}>
                {ROLE_CONFIG[role]?.label || role}
              </Select.Option>
            ))}
          </Select>
        </div>

        <Table
          columns={columns}
          dataSource={filteredAdmins}
          rowKey="_id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => (
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                {total} administrator{total !== 1 ? 's' : ''}
              </span>
            ),
          }}
          scroll={{ x: 900 }}
        />
      </Card>

      {/* ── Create / Edit Modal ─────────────────────────── */}
      <Modal
        title={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '16px',
              fontWeight: 700,
            }}
          >
            {editingUser ? (
              <>
                <Edit3 size={20} style={{ color: 'var(--primary)' }} />
                Edit Administrator
              </>
            ) : (
              <>
                <UserPlus size={20} style={{ color: 'var(--primary)' }} />
                Create Administrator
              </>
            )}
          </div>
        }
        open={isModalOpen}
        onCancel={handleModalClose}
        footer={null}
        width={560}
        destroyOnClose
      >
        <Divider style={{ margin: '16px 0' }} />
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ role: 'ADMIN', isActive: true }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Full Name"
                rules={[{ required: true, message: 'Name is required' }]}
              >
                <Input placeholder="e.g. Ahmed Youssef" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="Phone Number"
                rules={[{ required: true, message: 'Phone is required' }]}
              >
                <Input placeholder="e.g. +20 100 123 4567" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="email"
            label="Email Address"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Enter a valid email' },
            ]}
          >
            <Input placeholder="e.g. ahmed@dride.com" />
          </Form.Item>

          <Form.Item
            name="password"
            label={
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={14} />
                {editingUser ? 'Reset Password' : 'Password'}
                {editingUser && (
                  <Text
                    type="secondary"
                    style={{ fontSize: '11px', fontWeight: 400 }}
                  >
                    (leave empty to keep current)
                  </Text>
                )}
              </span>
            }
            rules={
              editingUser
                ? [
                    {
                      min: 6,
                      message: 'Password must be at least 6 characters',
                    },
                  ]
                : [
                    { required: true, message: 'Password is required' },
                    {
                      min: 6,
                      message: 'Password must be at least 6 characters',
                    },
                  ]
            }
          >
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder={
                editingUser
                  ? 'Enter new password to reset...'
                  : 'Minimum 6 characters'
              }
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--text-muted)',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="role"
                label="Role"
                rules={[{ required: true, message: 'Role is required' }]}
              >
                <Select>
                  {ADMIN_ROLES.map((role) => {
                    const config = ROLE_CONFIG[role];
                    const RoleIcon = config.icon;
                    return (
                      <Select.Option key={role} value={role}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <RoleIcon size={14} style={{ color: config.color }} />
                          <span>{config.label}</span>
                        </div>
                      </Select.Option>
                    );
                  })}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="isActive"
                label="Account Status"
                valuePropName="checked"
                getValueFromEvent={(checked) => checked}
                initialValue={true}
              >
                <Select
                  value={form.getFieldValue('isActive')}
                  onChange={(val) => form.setFieldsValue({ isActive: val })}
                >
                  <Select.Option value={true}>
                    <Tag color="green" style={{ margin: 0 }}>
                      Active
                    </Tag>
                  </Select.Option>
                  <Select.Option value={false}>
                    <Tag color="red" style={{ margin: 0 }}>
                      Suspended
                    </Tag>
                  </Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0 20px' }} />

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
            }}
          >
            <Button htmlType="button" onClick={handleModalClose}>
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              style={{
                background: 'var(--primary-color)',
                fontWeight: 600,
              }}
            >
              {editingUser ? 'Save Changes' : 'Create Administrator'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ── Detail Drawer ───────────────────────────────── */}
      <Drawer
        title={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Shield size={20} style={{ color: 'var(--primary)' }} />
            <span style={{ fontWeight: 700 }}>Staff Profile</span>
          </div>
        }
        open={isDrawerOpen}
        onClose={closeDrawer}
        width={420}
        destroyOnClose
      >
        {selectedUser && (() => {
          const config =
            ROLE_CONFIG[selectedUser.role] || ROLE_CONFIG.ADMIN;
          const RoleIcon = config.icon;
          const initials = selectedUser.name
            ? selectedUser.name
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)
            : 'AD';
          const active = selectedUser.isActive !== false;

          return (
            <div>
              {/* Profile Header */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '1.5rem 0',
                }}
              >
                <Avatar
                  size={72}
                  style={{
                    background: config.gradient,
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '24px',
                    boxShadow: `0 8px 24px ${config.color}40`,
                    marginBottom: '1rem',
                  }}
                >
                  {initials}
                </Avatar>
                <Title
                  level={4}
                  style={{ margin: 0, textAlign: 'center' }}
                >
                  {selectedUser.name}
                </Title>
                <Tag
                  style={{
                    color: config.color,
                    background: `${config.color}15`,
                    borderColor: `${config.color}30`,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    marginTop: '8px',
                  }}
                >
                  <RoleIcon size={13} />
                  {config.label}
                </Tag>
              </div>

              <Divider />

              {/* Contact Details */}
              <div style={{ marginBottom: '1.5rem' }}>
                <Text
                  strong
                  style={{
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: '12px',
                  }}
                >
                  Contact Details
                </Text>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '10px',
                    fontSize: '14px',
                  }}
                >
                  <Mail
                    size={16}
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <span>{selectedUser.email}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '10px',
                    fontSize: '14px',
                  }}
                >
                  <Phone
                    size={16}
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <code>{selectedUser.phone || 'N/A'}</code>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '14px',
                  }}
                >
                  <Calendar
                    size={16}
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <span>
                    Joined{' '}
                    {selectedUser.createdAt
                      ? new Date(
                          selectedUser.createdAt,
                        ).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'N/A'}
                  </span>
                </div>
              </div>

              <Divider />

              {/* Account Status */}
              <div style={{ marginBottom: '1.5rem' }}>
                <Text
                  strong
                  style={{
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: '12px',
                  }}
                >
                  Account Status
                </Text>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Tag
                    color={active ? 'green' : 'red'}
                    style={{
                      fontWeight: 'bold',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {active ? 'Active' : 'Suspended'}
                  </Tag>
                  <Popconfirm
                    title={`${active ? 'Suspend' : 'Activate'} this account?`}
                    onConfirm={() =>
                      handleToggleStatus(selectedUser._id, active)
                    }
                    okText="Confirm"
                    cancelText="Cancel"
                  >
                    <Button
                      size="small"
                      htmlType="button"
                      danger={active}
                      type={active ? 'default' : 'primary'}
                      style={
                        !active
                          ? {
                              background: 'var(--success)',
                              borderColor: 'var(--success)',
                            }
                          : {}
                      }
                    >
                      {active ? 'Suspend Account' : 'Activate Account'}
                    </Button>
                  </Popconfirm>
                </div>
              </div>

              <Divider />

              {/* Quick Actions */}
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button
                  block
                  htmlType="button"
                  icon={<Edit3 size={16} />}
                  onClick={() => {
                    closeDrawer();
                    openEditModal(selectedUser);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    justifyContent: 'center',
                    height: '40px',
                    borderRadius: '8px',
                  }}
                >
                  Edit Profile
                </Button>
                <Button
                  block
                  htmlType="button"
                  icon={<Lock size={16} />}
                  onClick={() => {
                    closeDrawer();
                    openEditModal(selectedUser);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    justifyContent: 'center',
                    height: '40px',
                    borderRadius: '8px',
                  }}
                >
                  Reset Password
                </Button>
              </Space>
            </div>
          );
        })()}
      </Drawer>
    </div>
  );
}
