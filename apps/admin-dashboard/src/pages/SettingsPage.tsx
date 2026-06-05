import { useState, useEffect } from 'react';
import { Form, Input, Button, Switch, Tabs, Card, Typography, Row, Col, Space, InputNumber, Table, Checkbox, Spin } from 'antd';
import { message } from '../utils/antdGlobal';
import { Globe, CreditCard, CarFront, Settings as SettingsIcon, Shield, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usersAPI, settingsAPI, whatsappAPI } from '../services/api';

const { Title, Paragraph, Text } = Typography;

export function SettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState<string | null>(null);

  const [whatsappStatus, setWhatsappStatus] = useState<string>('DISCONNECTED');
  const [whatsappQr, setWhatsappQr] = useState<string | null>(null);
  const [whatsappActionLoading, setWhatsappActionLoading] = useState(false);

  const fetchWhatsappStatus = async () => {
    try {
      const res = await whatsappAPI.getStatus();
      setWhatsappStatus(res.status);
      setWhatsappQr(res.qrCode);
    } catch (err) {
      console.error('Failed to fetch WhatsApp connection status', err);
    }
  };

  useEffect(() => {
    fetchWhatsappStatus();
    const interval = setInterval(fetchWhatsappStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const permissionsList = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'routes', label: 'Routes' },
    { key: 'trips', label: 'Trips' },
    { key: 'vehicles', label: 'Vehicles' },
    { key: 'drivers', label: 'Drivers' },
    { key: 'bookings', label: 'Bookings' },
    { key: 'refunds', label: 'Refund Requests' },
    { key: 'payments', label: 'Payments' },
    { key: 'finance-calculator', label: 'Profit Simulator' },
    { key: 'passengers', label: 'Passengers' },
    { key: 'crm', label: 'CRM (Users)' },
    { key: 'support-tickets', label: 'Support Tickets' },
    { key: 'settings', label: 'Settings & Admins' },
    { key: 'partners', label: 'Partners' },
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

  const loadSystemSettings = async () => {
    try {
      setLoading(true);
      const settings = await settingsAPI.get();
      form.setFieldsValue(settings);
      localStorage.setItem('dride_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to load system settings', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSystemSettings();
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
      const updated = await settingsAPI.save(values);
      localStorage.setItem('dride_settings', JSON.stringify(updated));
      message.success('System settings updated successfully!');
    } catch (error) {
      message.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  // Load mock/saved initial values as a synchronous fallback prior to API promise resolving
  const getInitialValues = () => {
    const saved = localStorage.getItem('dride_settings');
    if (saved) return JSON.parse(saved);
    return {
      appName: 'D-Ride',
      supportEmail: 'support@dride.com',
      supportPhone: '+20 100 123 4567',
      currency: 'EGP',
      paymobIntegrationId: '123456',
      paymobFrameId: '78901',
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
        <Card variant="borderless" className="glass" style={{ background: 'var(--surface-elevated)' }}>
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
        <Card variant="borderless" className="glass" style={{ background: 'var(--surface-elevated)' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <Text type="secondary">
              Configure the connection keys to your Paymob merchant account for credit cards and mobile wallet processing.
            </Text>
          </div>
          <Row gutter={24}>
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
        <Card variant="borderless" className="glass" style={{ background: 'var(--surface-elevated)' }}>
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
    {
      key: 'whatsapp',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MessageCircle size={16} /> WhatsApp Gateway</span>,
      children: (
        <Card variant="borderless" className="glass" style={{ background: 'var(--surface-elevated)' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <Title level={4}>WhatsApp Gateway Connection</Title>
            <Paragraph type="secondary">
              Connect a WhatsApp account via OpenWA to send booking ticket notifications and handle passenger customer support chats in real-time.
            </Paragraph>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 0', minHeight: '300px' }}>
            {whatsappStatus === 'CONNECTING' && (
              <Space direction="vertical" align="center" size="large">
                <Spin size="large" tip="Connecting to WhatsApp service..." />
                <Text type="secondary">Initializing headless browser and session files. Please wait...</Text>
              </Space>
            )}

            {whatsappStatus === 'DISCONNECTED' && (
              <Space direction="vertical" align="center" size="middle">
                <div style={{ padding: '1.5rem', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageCircle size={48} />
                </div>
                <Title level={5} style={{ margin: 0 }}>WhatsApp Gateway is Offline</Title>
                <Text type="secondary">The WhatsApp automation server is not currently running or configured.</Text>
                <Button 
                  type="primary" 
                  loading={whatsappActionLoading}
                  onClick={async () => {
                    try {
                      setWhatsappActionLoading(true);
                      await whatsappAPI.restart();
                      fetchWhatsappStatus();
                    } catch (err) {
                      // Handled by axios interceptor
                    } finally {
                      setWhatsappActionLoading(false);
                    }
                  }}
                  style={{ background: 'var(--primary-color)' }}
                >
                  Start Connection
                </Button>
              </Space>
            )}

            {whatsappStatus === 'SCAN_QR' && (
              <Row gutter={[24, 24]} align="middle" justify="center" style={{ width: '100%', maxWidth: '700px' }}>
                <Col xs={24} md={12} style={{ display: 'flex', justifyContent: 'center' }}>
                  {whatsappQr ? (
                    <div style={{ padding: '16px', background: '#ffffff', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}>
                      <img src={whatsappQr} alt="WhatsApp QR Code" style={{ width: '220px', height: '220px', display: 'block' }} />
                    </div>
                  ) : (
                    <Spin tip="Generating QR Code..." />
                  )}
                </Col>
                <Col xs={24} md={12}>
                  <Space direction="vertical" size="middle">
                    <Title level={5} style={{ margin: 0, color: 'var(--primary-color)' }}>Link WhatsApp Account</Title>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <Text><Text strong>1.</Text> Open WhatsApp on your mobile phone.</Text>
                      <Text><Text strong>2.</Text> Tap the Menu (⋮) or Settings icon and select <Text strong>Linked Devices</Text>.</Text>
                      <Text><Text strong>3.</Text> Tap <Text strong>Link a Device</Text>.</Text>
                      <Text><Text strong>4.</Text> Scan the QR code shown on the left with your phone's camera.</Text>
                    </div>
                    <Button 
                      loading={whatsappActionLoading}
                      onClick={async () => {
                        try {
                          setWhatsappActionLoading(true);
                          await whatsappAPI.restart();
                          fetchWhatsappStatus();
                        } catch (err) {}
                        finally { setWhatsappActionLoading(false); }
                      }}
                      style={{ marginTop: '8px' }}
                    >
                      Regenerate QR Code
                    </Button>
                  </Space>
                </Col>
              </Row>
            )}

            {whatsappStatus === 'CONNECTED' && (
              <Space direction="vertical" align="center" size="middle" style={{ textAlign: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ padding: '1.5rem', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageCircle size={48} />
                  </div>
                  <div style={{ position: 'absolute', right: '4px', bottom: '4px', width: '16px', height: '16px', borderRadius: '50%', background: '#22c55e', border: '3px solid var(--surface-elevated)' }} />
                </div>
                <Title level={5} style={{ margin: 0, color: '#22c55e' }}>WhatsApp Gateway is Connected</Title>
                <Text type="secondary">The platform is active and ready to deliver tickets and process customer service messages.</Text>
                <Button 
                  danger
                  type="text"
                  loading={whatsappActionLoading}
                  onClick={async () => {
                    try {
                      setWhatsappActionLoading(true);
                      await whatsappAPI.restart();
                      fetchWhatsappStatus();
                    } catch (err) {}
                    finally { setWhatsappActionLoading(false); }
                  }}
                  style={{ marginTop: '1rem' }}
                >
                  Disconnect Account
                </Button>
              </Space>
            )}
          </div>
        </Card>
      ),
    },
  ];

  if (user?.role === 'OWNER') {
    items.push({
      key: 'permissions',
      label: <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Shield size={16} /> Role Permissions</span>,
      children: (
        <Card variant="borderless" className="glass" style={{ background: 'var(--surface-elevated)' }}>
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
            <div className="table-scroll-container">
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
                    width: 130,
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
                scroll={{ x: 2200 }}
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
