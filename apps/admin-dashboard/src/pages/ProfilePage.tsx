import { useAuth } from '../context/AuthContext';
import { Card, Tag, Typography, Row, Col, Space, Divider } from 'antd';
import { User, Mail, Shield, Calendar, Key, AlertCircle } from 'lucide-react';

const { Title, Text } = Typography;

export function ProfilePage() {
  const { user } = useAuth();

  const getInitials = () => {
    if (!user?.name) return 'A';
    return user.name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '900px', margin: '0 auto' }}>
      <Row gutter={[24, 24]}>
        {/* Left Column: Avatar and Quick Stats */}
        <Col xs={24} md={8}>
          <Card
            className="glass-card"
            style={{
              textAlign: 'center',
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', margin: '1rem 0' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                color: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                fontWeight: 'bold',
                boxShadow: '0 0 20px rgba(245, 183, 49, 0.35)',
                border: '2px solid rgba(255, 255, 255, 0.1)'
              }}>
                {getInitials()}
              </div>
              
              <Title level={4} style={{ margin: '8px 0 0 0', color: 'var(--text-primary)', fontWeight: 800 }}>
                {user?.name || 'Administrator'}
              </Title>
              
              <Tag color="gold" style={{ fontWeight: 'bold', fontSize: '11px', padding: '3px 12px', borderRadius: '100px', border: '1px solid rgba(245, 183, 49, 0.25)' }}>
                {user?.role || 'ADMIN'}
              </Tag>
            </div>

            <Divider style={{ borderColor: 'var(--border)' }} />

            <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <Shield size={16} style={{ color: 'var(--success)' }} />
                <Text style={{ color: 'var(--text-secondary)' }}>System Active</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <Calendar size={16} style={{ color: 'var(--primary)' }} />
                <Text style={{ color: 'var(--text-secondary)' }}>Joined May 2026</Text>
              </div>
            </div>
          </Card>
        </Col>

        {/* Right Column: Account Details & Permissions List */}
        <Col xs={24} md={16}>
          <Card
            title={
              <Space style={{ color: 'var(--text-primary)' }}>
                <User size={18} style={{ color: 'var(--primary)' }} />
                <span style={{ fontWeight: 800 }}>Account Specifications</span>
              </Space>
            }
            className="glass-card"
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                  Full Display Name
                </Text>
                <Text strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
                  {user?.name || 'Administrator'}
                </Text>
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                  Email Address
                </Text>
                <Space style={{ color: 'var(--text-primary)' }}>
                  <Mail size={14} style={{ color: 'var(--primary)' }} />
                  <Text strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
                    {user?.email || 'admin@d-ride.com'}
                  </Text>
                </Space>
              </div>

              <Divider style={{ margin: '12px 0', borderColor: 'var(--border)' }} />

              <div>
                <Space style={{ marginBottom: '8px' }}>
                  <Key size={14} style={{ color: 'var(--primary)' }} />
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Access & Capabilities
                  </Text>
                </Space>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                  {user?.role === 'OWNER' ? (
                    <Tag color="purple" style={{ fontWeight: 700, padding: '4px 12px', borderRadius: '4px' }}>
                      All (Full Bypass Level)
                    </Tag>
                  ) : user?.permissions && user.permissions.length > 0 ? (
                    user.permissions.map((perm: string) => (
                      <Tag key={perm} color="blue" style={{ fontWeight: 600, padding: '3px 10px', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        {perm.toUpperCase()}
                      </Tag>
                    ))
                  ) : (
                    <Tag color="default" style={{ padding: '3px 10px' }}>No Explicit Permissions Assigned</Tag>
                  )}
                </div>
              </div>

              <div style={{ 
                background: 'rgba(245, 183, 49, 0.05)', 
                border: '1px dashed rgba(245, 183, 49, 0.25)', 
                borderRadius: '8px', 
                padding: '12px 16px',
                marginTop: '10px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px'
              }}>
                <AlertCircle size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
                <Text style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Administrative profile credentials are synchronized with the central gateway database directory. To adjust permissions or update credentials, please coordinate with system owners.
                </Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
