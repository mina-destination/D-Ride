import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, Calendar, ShieldCheck, LogOut, Award, Navigation, Leaf, Lock } from 'lucide-react';
import { authAPI } from '../services/api';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { t, language } = useTranslation();
  const navigate = useNavigate();

  // Change Password States
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changePasswordStep, setChangePasswordStep] = useState(1);
  const [changePasswordOtp, setChangePasswordOtp] = useState('');
  const [changePasswordNewPassword, setChangePasswordNewPassword] = useState('');
  const [changePasswordConfirmPassword, setChangePasswordConfirmPassword] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('');

  const handleChangePasswordRequest = async () => {
    setChangePasswordError('');
    setChangePasswordSuccess('');
    setChangePasswordLoading(true);
    try {
      await authAPI.changePasswordRequest();
      setChangePasswordSuccess('A verification OTP has been sent to your email.');
      setChangePasswordStep(2);
    } catch (err: any) {
      setChangePasswordError(err?.message || 'Failed to dispatch verification OTP');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError('');
    setChangePasswordSuccess('');
    
    if (changePasswordNewPassword !== changePasswordConfirmPassword) {
      setChangePasswordError('Passwords do not match');
      return;
    }

    setChangePasswordLoading(true);
    try {
      await authAPI.changePassword({
        otp: changePasswordOtp,
        newPassword: changePasswordNewPassword,
      });
      setChangePasswordSuccess('Password updated successfully!');
      setTimeout(() => {
        setShowChangePasswordModal(false);
      }, 2000);
    } catch (err: any) {
      setChangePasswordError(err?.message || 'Failed to change password. Please check the OTP.');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = () => {
    if (!user?.name) return 'C';
    return user.name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="page-container">
      {/* Dynamic background glows */}
      <div className="hero-bg-gradient" style={{ top: '-10%', right: '-5%' }} />
      <div className="hero-bg-gradient-2" style={{ bottom: '-10%', left: '-5%' }} />

      <div style={{
        maxWidth: '850px',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr 1.3fr',
        gap: '2.5rem',
        alignItems: 'start'
      }} className="contact-container">
        
        {/* Left Card: Avatar & Brand Tag */}
        <div className="auth-card glass" style={{ margin: 0, padding: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.5rem' }}>
          <div style={{ alignSelf: 'flex-start' }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title="Go Back"
              className="btn-back"
            >
              <ArrowLeft size={16} style={{ transform: language === 'ar' ? 'rotate(180deg)' : 'none' }} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '96px',
              height: '96px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              color: 'var(--text-on-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
              fontWeight: 800,
              boxShadow: '0 0 25px rgba(245, 183, 49, 0.45)',
              border: '2px solid rgba(255, 255, 255, 0.1)'
            }}>
              {getInitials()}
            </div>
            <h2 className="title-outfit" style={{ margin: '8px 0 0 0', fontSize: '1.5rem', color: 'var(--text-primary)', fontWeight: 800 }}>
              {user?.name || 'Commuter'}
            </h2>
            <span style={{
              fontSize: '10px',
              fontWeight: 800,
              color: 'black',
              background: 'var(--primary)',
              padding: '4px 12px',
              borderRadius: '100px',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              boxShadow: '0 4px 10px rgba(245, 183, 49, 0.2)'
            }}>
              {user?.role || 'PASSENGER'}
            </span>
          </div>

          <div style={{ 
            width: '100%', 
            borderTop: '1px solid var(--border)', 
            paddingTop: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <ShieldCheck size={16} style={{ color: 'var(--success)' }} />
              <span>Verified Account Status</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <Calendar size={16} style={{ color: 'var(--primary)' }} />
              <span>Member Since May 2026</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="btn btn-danger btn-block"
            style={{ 
              marginTop: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px'
            }}
          >
            <LogOut size={16} />
            {t('signOut') || 'Sign Out'}
          </button>
        </div>

        {/* Right Card: Account Details & Ride Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* User Information */}
          <div className="auth-card glass" style={{ margin: 0, padding: '2.5rem', width: '100%' }}>
            <h3 className="title-outfit" style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 1.5rem 0', color: 'var(--text-primary)' }}>
              Account Settings
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  Full Name
                </label>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <User size={16} style={{ color: 'var(--primary)' }} />
                  <span>{user?.name || 'Commuter'}</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  Email Address
                </label>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  wordBreak: 'break-all'
                }}>
                  <Mail size={16} style={{ color: 'var(--primary)' }} />
                  <span>{user?.email || 'N/A'}</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  Phone Number
                </label>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <Phone size={16} style={{ color: 'var(--primary)' }} />
                  <span>{user?.phone || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Security & Password Card */}
          <div className="auth-card glass" style={{ margin: 0, padding: '2.5rem', width: '100%' }}>
            <h3 className="title-outfit" style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>
              Security & Password
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.4 }}>
              To ensure your account safety, D-Ride requires verifying a 6-digit OTP code sent to your registered email before updating your login credentials.
            </p>
            <button
              onClick={() => {
                setShowChangePasswordModal(true);
                setChangePasswordStep(1);
                setChangePasswordOtp('');
                setChangePasswordNewPassword('');
                setChangePasswordConfirmPassword('');
                setChangePasswordError('');
                setChangePasswordSuccess('');
              }}
              className="btn btn-primary btn-block"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                fontWeight: 700
              }}
              id="change-password-trigger"
            >
              <Lock size={16} />
              Change Account Password
            </button>
          </div>

          {/* Loyalty & Impact stats */}
          <div className="glass" style={{
            padding: '2rem',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.5rem',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(245, 183, 49, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <Navigation size={20} />
              </div>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>12</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Rides Booked</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
                <Leaf size={20} />
              </div>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>4.8 kg</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>CO₂ Saved</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                <Award size={20} />
              </div>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>Gold</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Rider Tier</span>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(6, 6, 14, 0.85)',
            backdropFilter: 'blur(16px)',
            zIndex: 10007,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div 
            style={{
              background: '#121224',
              color: '#ffffff',
              borderRadius: '24px',
              padding: '2.5rem 2rem',
              maxWidth: '420px',
              width: '100%',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6)',
              position: 'relative'
            }}
          >
            <button 
              onClick={() => setShowChangePasswordModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                color: '#a3a3a3',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '14px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              ✕
            </button>

            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#f5b731' }}>Change Password</h2>
              <p style={{ fontSize: '0.9rem', color: '#a3a3a3', margin: 0 }}>
                {changePasswordStep === 1 
                  ? 'Request a security verification OTP to your registered email.' 
                  : 'Enter the 6-digit verification code and configure your new password.'}
              </p>
            </div>

            {changePasswordError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '10px 14px',
                borderRadius: '12px',
                fontSize: '0.85rem',
                marginBottom: '1.5rem',
                fontWeight: 500
              }}>
                {changePasswordError}
              </div>
            )}

            {changePasswordSuccess && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34d399',
                padding: '10px 14px',
                borderRadius: '12px',
                fontSize: '0.85rem',
                marginBottom: '1.5rem',
                fontWeight: 500
              }}>
                {changePasswordSuccess}
              </div>
            )}

            {changePasswordStep === 1 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.9rem', color: '#d1d5db', margin: 0 }}>
                  A verification code will be sent to: <strong style={{ color: '#f5b731' }}>{user?.email}</strong>
                </p>
                <button
                  onClick={handleChangePasswordRequest}
                  disabled={changePasswordLoading}
                  style={{
                    background: '#f5b731',
                    color: '#06060e',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px',
                    fontWeight: 700,
                    fontSize: '1rem',
                    cursor: 'pointer',
                    opacity: changePasswordLoading ? 0.7 : 1
                  }}
                  id="request-change-otp-btn"
                >
                  {changePasswordLoading ? 'Sending OTP...' : 'Send Verification OTP'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleChangePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="cp-otp" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e5e7eb' }}>6-Digit Code</label>
                  <input
                    id="cp-otp"
                    type="text"
                    maxLength={6}
                    value={changePasswordOtp}
                    onChange={(e) => setChangePasswordOtp(e.target.value)}
                    placeholder="123456"
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      fontSize: '1.1rem',
                      letterSpacing: '6px',
                      textAlign: 'center',
                      background: 'rgba(255,255,255,0.03)',
                      color: '#f5b731',
                      fontWeight: 'bold',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="cp-password" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e5e7eb' }}>New Password</label>
                  <input
                    id="cp-password"
                    type="password"
                    value={changePasswordNewPassword}
                    onChange={(e) => setChangePasswordNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      fontSize: '0.95rem',
                      background: 'rgba(255,255,255,0.03)',
                      color: 'white',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="cp-confirm-password" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e5e7eb' }}>Confirm Password</label>
                  <input
                    id="cp-confirm-password"
                    type="password"
                    value={changePasswordConfirmPassword}
                    onChange={(e) => setChangePasswordConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      fontSize: '0.95rem',
                      background: 'rgba(255,255,255,0.03)',
                      color: 'white',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setChangePasswordStep(1)}
                    style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'white',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Back
                  </button>
                  
                  <button
                    type="submit"
                    disabled={changePasswordLoading}
                    style={{
                      flex: 2,
                      background: '#f5b731',
                      color: '#06060e',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      opacity: changePasswordLoading ? 0.7 : 1
                    }}
                    id="change-password-submit-btn"
                  >
                    {changePasswordLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
