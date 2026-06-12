import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, Tag, Typography, Row, Col, Space, Divider, Input, Button, Form, message } from 'antd';
import { User, Mail, Shield, Calendar, Key, AlertCircle, Save, Lock } from 'lucide-react';
import { authAPI } from '../services/api';

const { Title, Text } = Typography;

export function ProfilePage() {
  const { user, syncProfile } = useAuth();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');

  const [otpRequesting, setOtpRequesting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const getInitials = () => {
    if (!user?.name) return 'A';
    return user.name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await authAPI.updateProfile({ name, phone });
      await syncProfile();
      message.success('Profile updated successfully');
      setEditing(false);
    } catch (err) {
      message.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestOtp = async () => {
    try {
      setOtpRequesting(true);
      await authAPI.changePasswordRequest();
      setOtpSent(true);
      message.success('OTP sent to your email');
    } catch (err) {
      message.error('Failed to request OTP');
    } finally {
      setOtpRequesting(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      message.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      message.error('Password must be at least 6 characters');
      return;
    }
    try {
      setChangingPassword(true);
      await authAPI.changePassword({ otp, newPassword });
      message.success('Password changed successfully');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setOtpSent(false);
    } catch (err) {
      message.error('Failed to change password');
    } finally {
      setChangingPassword(false);
    }
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

        {/* Right Column: Account Details & Password Change */}
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
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
              marginBottom: '24px'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                  Full Display Name
                </Text>
                {editing ? (
                  <Input value={name} onChange={e => setName(e.target.value)} style={{ background: 'var(--background)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />
                ) : (
                  <Text strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
                    {user?.name || 'Administrator'}
                  </Text>
                )}
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

              <div>
                <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                  Phone Number
                </Text>
                {editing ? (
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Enter phone number" style={{ background: 'var(--background)', color: 'var(--text-primary)', border: '1px solid var(--border)' }} />
                ) : (
                  <Text strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
                    {user?.phone || 'Not set'}
                  </Text>
                )}
              </div>

              <Divider style={{ margin: '12px 0', borderColor: 'var(--border)' }} />

              {editing ? (
                <Space>
                  <Button type="primary" onClick={handleSave} loading={saving} style={{ background: 'var(--primary-color)', color: 'black', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Save size={16} /> Save Changes
                  </Button>
                  <Button onClick={() => setEditing(false)}>Cancel</Button>
                </Space>
              ) : (
                <Button onClick={() => { setName(user?.name || ''); setPhone(user?.phone || ''); setEditing(true); }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Save size={16} /> Edit Profile
                </Button>
              )}

              <div style={{ 
                background: 'rgba(245, 183, 49, 0.05)', 
                border: '1px dashed rgba(245, 183, 49, 0.25)', 
                borderRadius: '8px', 
                padding: '12px 16px',
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

          {/* Change Password Section */}
          <Card
            title={
              <Space style={{ color: 'var(--text-primary)' }}>
                <Lock size={18} style={{ color: 'var(--primary)' }} />
                <span style={{ fontWeight: 800 }}>Change Password</span>
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
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Button onClick={handleRequestOtp} loading={otpRequesting} disabled={otpSent} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={16} /> {otpSent ? 'OTP Sent' : 'Request OTP'}
              </Button>

              {otpSent && (
                <>
                  <div>
                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                      OTP Code
                    </Text>
                    <Input
                      value={otp}
                      onChange={e => setOtp(e.target.value)}
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                      style={{ width: 200, background: 'var(--background)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                      New Password
                    </Text>
                    <Input.Password
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      style={{ width: 300, background: 'var(--background)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                      Confirm Password
                    </Text>
                    <Input.Password
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      style={{ width: 300, background: 'var(--background)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                    />
                  </div>
                  <Button type="primary" onClick={handleChangePassword} loading={changingPassword} style={{ background: 'var(--primary-color)', color: 'black', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={16} /> Change Password
                  </Button>
                </>
              )}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
