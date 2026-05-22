import { useState, useEffect } from 'react';
import { Form, Input, Button, Switch, Tabs, Card, Typography, Row, Col, Space, message, InputNumber, Table, Checkbox, Spin } from 'antd';
import { Globe, CreditCard, CarFront, Settings as SettingsIcon, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usersAPI } from '../services/api';

const { Title, Paragraph, Text } = Typography;

export function SettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState<string | null>(null);

  const permissionsList = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'routes', label: 'Routes' },
    { key: 'trips', label: 'Trips' },
    { key: 'vehicles', label: 'Vehicles' },
    { key: 'drivers', label: 'Drivers' },
    { key: 'bookings', label: 'Bookings' },
    { key: 'payments', label: 'Payments' },
    { key: 'passengers', label: 'Passengers' },
    { key: 'crm', label: 'CRM (Users)' },
    { key: 'settings', label: 'Settings' },
  ];

  const loadPermissions = async () => {
    try {
      setLoadingPermissions(true);
      const res = await usersAPI.getRolePermissions();
      const mapping: Record<string, string[]> = {};
      res.forEach((item: any) => {
        mapping[item.role.toUpperCase()] = item.permissions;
      });
      ['SUPER_ADMIN', 'ADMIN', 'OPERATION'].forEach(role => {
        if (!mapping[role]) {
          mapping[role] = [];
        }
      });
      setRolePermissions(mapping);
    } catch (error) {
      message.error('Failed to load role permissions');
    } finally {
      setLoadingPermissions(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'OWNER') {
      loadPermissions();
    }
  }, [user]);

  const handleCheckboxChange = (role: string, permissionKey: string, checked: boolean) => {
    setRolePermissions(prev => {
      const current = prev[role] || [];
      const updated = checked
        ? [...current, permissionKey]
        : current.filter(p => p !== permissionKey);
      return {
        ...prev,
        [role]: updated
      };
    });
  };

  const saveRolePermissions = async (role: string) => {
    try {
      setSavingPermissions(role);
      const permissions = rolePermissions[role] || [];
      await usersAPI.updateRolePermissions(role, permissions);
      message.success(`Permissions for ${role} updated successfully!`);
    } catch (error) {
      message.error(`Failed to update permissions for ${role}`);
    } finally {
      setSavingPermissions(null);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      localStorage.setItem('dride_settings', JSON.stringify(values));
      message.success('System settings updated successfully!');
    } catch (error) {
      message.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  // Load mock/saved initial values
  const getInitialValues = () => {
    const saved = localStorage.getItem('dride_settings');
    if (saved) return JSON.parse(saved);
    return {
      appName: 'D-Ride',
      supportEmail: 'support@dride.com',
      supportPhone: '+20 100 123 4567',
      currency: 'EGP',
      paymobApiKey: 'ZXlKaGJHY2lPaUpJVXpVMU1pSjkuLi4=',
      paymobIntegrationId: '123456',
      paymobFrameId: '78901',
      paymobHmac: 'a1b2c3d4e5f6',
      isSandbox: true,
      maxSeats: 4,
      bookingWindow: 14,
      cancelTimeout: 15,
      enableLiveTracking: true,
      gpsInterval: 5,
    };
  };

  const items = [
    {
      key: 'general',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Globe size={16} /> General Settings</span>,
      children: (
        <Card bordered={false} className="glass" style={{ background: 'var(--surface-elevated)' }}>
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="appName"
                label="Application Name"
                rules={[{ required: true }]}
              >
                <Input placeholder="e.g. D-Ride" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="currency"
                label="Base Currency"
                rules={[{ required: true }]}
              >
                <Input placeholder="e.g. EGP" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="supportEmail"
                label="Support Email Address"
                rules={[{ required: true, type: 'email' }]}
              >
                <Input placeholder="support@dride.com" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="supportPhone"
                label="Support Phone Number"
                rules={[{ required: true }]}
              >
                <Input placeholder="+20 100 123 4567" />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      ),
    },
    {
      key: 'payments',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CreditCard size={16} /> Paymob Integration</span>,
      children: (
        <Card bordered={false} className="glass" style={{ background: 'var(--surface-elevated)' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <Text type="secondary">
              Configure the connection keys to your Paymob merchant account for credit cards and mobile wallet processing.
            </Text>
          </div>
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="paymobApiKey"
                label="Paymob API Key (Secret)"
                rules={[{ required: true }]}
              >
                <Input.Password placeholder="Enter Paymob Secret Key" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="paymobHmac"
                label="HMAC Webhook Secret"
                rules={[{ required: true }]}
              >
                <Input.Password placeholder="Used to validate callbacks" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="paymobIntegrationId"
                label="Card Integration ID"
                rules={[{ required: true }]}
              >
                <Input placeholder="e.g. 123456" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="paymobFrameId"
                label="Iframe ID"
                rules={[{ required: true }]}
              >
                <Input placeholder="e.g. 78901" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="isSandbox"
                label="Sandbox Environment"
                valuePropName="checked"
              >
                <Switch checkedChildren="TEST" unCheckedChildren="LIVE" />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      ),
    },
    {
      key: 'fleet',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CarFront size={16} /> Operations & Fleet</span>,
      children: (
        <Card bordered={false} className="glass" style={{ background: 'var(--surface-elevated)' }}>
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="maxSeats"
                label="Max Seats per Passenger Booking"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="bookingWindow"
                label="Advance Booking Window (Days)"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={90} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="cancelTimeout"
                label="Auto-Cancel Unpaid Bookings (Minutes)"
                rules={[{ required: true }]}
              >
                <InputNumber min={5} max={120} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Form.Item
                  name="enableLiveTracking"
                  label="Enable Live GPS Tracking"
                  valuePropName="checked"
                >
                  <Switch checkedChildren="ON" unCheckedChildren="OFF" />
                </Form.Item>
                <Form.Item
                  name="gpsInterval"
                  label="Driver GPS Push Frequency (Seconds)"
                  rules={[{ required: true }]}
                >
                  <InputNumber min={2} max={30} style={{ width: '100%' }} />
                </Form.Item>
              </Space>
            </Col>
          </Row>
        </Card>
      ),
    },
  ];

  if (user?.role === 'OWNER') {
    items.push({
      key: 'permissions',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Shield size={16} /> Role Permissions</span>,
      children: (
        <Card bordered={false} className="glass" style={{ background: 'var(--surface-elevated)' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <Title level={4}>Administrative Permissions Matrix</Title>
            <Text type="secondary">
              Customize accessible areas for staff roles. The <Text strong>OWNER</Text> role always has full access and bypasses these restrictions.
            </Text>
          </div>
          {loadingPermissions ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Spin tip="Loading permissions..." />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table
                dataSource={['SUPER_ADMIN', 'ADMIN', 'OPERATION'].map(role => ({ key: role, role }))}
                pagination={false}
                bordered
                columns={[
                  {
                    title: 'Role',
                    dataIndex: 'role',
                    key: 'role',
                    render: (text) => <Text strong>{text}</Text>,
                    width: 140,
                    fixed: 'left',
                  },
                  ...permissionsList.map(p => ({
                    title: p.label,
                    key: p.key,
                    align: 'center' as const,
                    render: (_: any, record: any) => (
                      <Checkbox
                        checked={rolePermissions[record.role]?.includes(p.key) || false}
                        onChange={(e) => handleCheckboxChange(record.role, p.key, e.target.checked)}
                      />
                    )
                  })),
                  {
                    title: 'Action',
                    key: 'action',
                    align: 'center' as const,
                    width: 120,
                    fixed: 'right' as const,
                    render: (_: any, record: any) => (
                      <Button
                        type="primary"
                        size="small"
                        htmlType="button"
                        loading={savingPermissions === record.role}
                        onClick={() => saveRolePermissions(record.role)}
                        style={{ background: 'var(--primary-color)' }}
                      >
                        Save
                      </Button>
                    )
                  }
                ]}
                scroll={{ x: 1100 }}
              />
            </div>
          )}
        </Card>
      ),
    });
  }

  return (
    <div style={{ padding: '2rem 0' }}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={getInitialValues()}
      >
        <div className="dashboard-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <Title level={2} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SettingsIcon size={28} /> System Settings
            </Title>
            <Paragraph>Configure business rules, GPS parameters, and payment gateways</Paragraph>
          </div>
          <Button type="primary" size="large" htmlType="submit" loading={loading} style={{ background: 'var(--primary-color)' }}>
            Save All Changes
          </Button>
        </div>

        <Tabs defaultActiveKey="general" items={items} type="card" />
      </Form>
    </div>
  );
}
