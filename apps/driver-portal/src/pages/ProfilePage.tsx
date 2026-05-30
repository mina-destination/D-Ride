import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Mail, Phone, ShieldCheck, LogOut, Truck, Compass, Award, Star, Globe, Lock } from 'lucide-react';
import logo from '../assets/d-ride-logo.jpeg';
import { driverAPI } from '../services/api';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { t, language, setLanguage, isRtl } = useTranslation();
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
      await driverAPI.changePasswordRequest();
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
      await driverAPI.changePassword({
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
    if (!user?.name) return 'D';
    return user.name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="app-container" style={{ direction: isRtl ? 'rtl' : 'ltr', paddingBottom: '80px' }}>
      {/* Top Header */}
      <div className="floating-header" style={{
        background: 'rgba(14, 14, 27, 0.45)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '100px',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: '1rem',
        zIndex: 10,
        margin: '1rem 1rem 0 1rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={logo} alt="Logo" style={{ height: '32px', width: 'auto', borderRadius: '4px', objectFit: 'contain', boxShadow: '0 0 10px rgba(245, 183, 49, 0.3)', flexShrink: 0 }} />
          <h2 className="title-outfit" style={{ fontSize: '15px', margin: 0, color: 'var(--text-primary)' }}>
            {t('profileTitle')}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', padding: 0 }}
            title={language === 'en' ? 'العربية' : 'English'}
          >
            <Globe size={18} />
          </button>
          <button
            onClick={handleLogout}
            style={{ color: 'var(--danger)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', padding: 0 }}
            title={t('signOut')}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Avatar Profile Card */}
        <div className="glass-card" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '1.75rem 1.25rem',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(14, 14, 27, 0.45)',
          gap: '12px'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
            color: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '30px',
            fontWeight: 800,
            boxShadow: '0 0 20px rgba(245, 183, 49, 0.35)',
            border: '2px solid rgba(255, 255, 255, 0.06)'
          }}>
            {getInitials()}
          </div>
          
          <div>
            <h3 className="title-outfit" style={{ margin: '4px 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
              {user?.name || 'Driver Captain'}
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {t('cairoRegionFleet')}
            </span>
          </div>

          <div style={{
            background: 'rgba(245, 183, 49, 0.1)',
            border: '1px solid rgba(245, 183, 49, 0.25)',
            borderRadius: '100px',
            padding: '3px 12px',
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--primary)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <ShieldCheck size={12} />
            {t('verifiedDriverStatus')}
          </div>
        </div>

        {/* Fleet Assignment Details */}
        <div className="glass-card" style={{
          padding: '1.25rem',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(14, 14, 27, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <h4 className="title-outfit" style={{ margin: '0 0 4px 0', fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Truck size={14} style={{ color: 'var(--primary)' }} />
            {t('assignedVehicle')}
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>Minibus Model</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Toyota HiAce Super</span>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>Plate Number</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>ط ج أ ٤٨٢</span>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>{t('licenseClass')}</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Class A Commercial</span>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>{t('fleetRegion')}</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Cairo-East Sector</span>
            </div>
          </div>
        </div>

        {/* Stats card */}
        <div className="glass-card" style={{
          padding: '1.25rem',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(14, 14, 27, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <h4 className="title-outfit" style={{ margin: '0 0 4px 0', fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Award size={14} style={{ color: 'var(--primary)' }} />
            {t('statsCapital')}
          </h4>

          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', textAlign: 'center', paddingTop: '4px' }}>
            <div>
              <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', display: 'block' }}>48</span>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{t('completedTripsCount')}</span>
            </div>
            <div style={{ width: '1px', height: '30px', background: 'rgba(255, 255, 255, 0.08)' }} />
            <div>
              <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'center' }}>
                4.9 <Star size={14} fill="var(--primary)" stroke="var(--primary)" />
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Driver Rating</span>
            </div>
            <div style={{ width: '1px', height: '30px', background: 'rgba(255, 255, 255, 0.08)' }} />
            <div>
              <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', display: 'block' }}>99.2%</span>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Punctuality</span>
            </div>
          </div>
        </div>

        {/* Contact Info Details */}
        <div className="glass-card" style={{
          padding: '1.25rem',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(14, 14, 27, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <h4 className="title-outfit" style={{ margin: '0 0 4px 0', fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Compass size={14} style={{ color: 'var(--primary)' }} />
            Contact Credentials
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Mail size={16} style={{ color: 'var(--text-muted)' }} />
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>{t('emailAddress')}</span>
                <span style={{ fontSize: '13px', fontWeight: 550, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{user?.email || 'N/A'}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Phone size={16} style={{ color: 'var(--text-muted)' }} />
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>Phone Number</span>
                <span style={{ fontSize: '13px', fontWeight: 550, color: 'var(--text-primary)' }}>{user?.phone || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Password Card */}
        <div className="glass-card" style={{
          padding: '1.25rem',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(14, 14, 27, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <h4 className="title-outfit" style={{ margin: '0 0 4px 0', fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lock size={14} style={{ color: 'var(--primary)' }} />
            Security & Credentials
          </h4>
          
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
            Change your account password by sending a 6-digit OTP verification code to your email.
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
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 700
            }}
            id="change-password-trigger"
          >
            <Lock size={14} />
            Change Account Password
          </button>
        </div>

        {/* Language selector inline card */}
        <div className="glass-card" style={{
          padding: '1.25rem',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(14, 14, 27, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>{t('languageSetting')}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setLanguage('en')}
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: '8px',
                border: language === 'en' ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: language === 'en' ? 'rgba(245, 183, 49, 0.12)' : 'transparent',
                color: language === 'en' ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              English
            </button>
            <button
              onClick={() => setLanguage('ar')}
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: '8px',
                border: language === 'ar' ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: language === 'ar' ? 'rgba(245, 183, 49, 0.12)' : 'transparent',
                color: language === 'ar' ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              العربية
            </button>
          </div>
        </div>

        {/* Dedicated Sign Out Button */}
        <button
          onClick={handleLogout}
          className="btn btn-danger btn-block"
          style={{
            marginTop: '10px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <LogOut size={18} />
          {t('signOut')}
        </button>

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
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      fontSize: '0.95rem',
                      background: 'rgba(255, 255, 255, 0.03)',
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
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      fontSize: '0.95rem',
                      background: 'rgba(255, 255, 255, 0.03)',
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
