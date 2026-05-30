import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, Eye, EyeOff, Globe } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { driverAPI } from '../services/api';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t, language, setLanguage, isRtl } = useTranslation();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Forgot Password States
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState(1);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordOtp, setForgotPasswordOtp] = useState('');
  const [forgotPasswordNewPassword, setForgotPasswordNewPassword] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(null);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState<string | null>(null);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordError(null);
    setForgotPasswordSuccess(null);
    setForgotPasswordLoading(true);
    try {
      await driverAPI.forgotPassword(forgotPasswordEmail);
      setForgotPasswordSuccess('An OTP has been sent to your email.');
      setForgotPasswordStep(2);
    } catch (err: any) {
      setForgotPasswordError(err?.message || 'Failed to request OTP');
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordError(null);
    setForgotPasswordSuccess(null);
    setForgotPasswordLoading(true);
    try {
      await driverAPI.resetPassword({
        email: forgotPasswordEmail,
        otp: forgotPasswordOtp,
        newPassword: forgotPasswordNewPassword,
      });
      setForgotPasswordSuccess('Password reset successfully! You can now log in.');
      setTimeout(() => {
        setShowForgotPasswordModal(false);
        setEmail(forgotPasswordEmail);
      }, 2000);
    } catch (err: any) {
      setForgotPasswordError(err?.message || 'Failed to reset password. Please check the OTP.');
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError(t('pleaseFillAll'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await login({ email, password });
      navigate('/trips');
    } catch (err: any) {
      setError(err?.message || t('loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '24px',
      position: 'relative'
    }}>
      {/* Floating Language Switcher Toggle */}
      <div style={{
        position: 'absolute',
        top: '24px',
        right: isRtl ? 'auto' : '24px',
        left: isRtl ? '24px' : 'auto',
        zIndex: 10
      }}>
        <button
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <Globe size={16} />
          <span>{language === 'en' ? 'العربية' : 'English'}</span>
        </button>
      </div>

      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #f5b731 0%, #d97706 100%)',
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto',
          boxShadow: '0 8px 24px rgba(245, 183, 49, 0.3)'
        }}>
          <Shield size={32} style={{ color: '#0e0e1b' }} />
        </div>
        <h1 className="title-outfit" style={{ fontSize: '28px', color: 'var(--text-primary)', marginBottom: '8px' }}>
          {t('brandName')}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500 }}>
          {t('driverCommandCenter')}
        </p>
      </div>

      {/* Login Card */}
      <div className="glass-card" style={{ width: '100%', maxWidth: '380px' }}>
        <h2 className="title-outfit" style={{ fontSize: '20px', marginBottom: '20px', textAlign: 'center' }}>
          {t('signIn')}
        </h2>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            marginBottom: '16px',
            textAlign: 'center',
            fontWeight: 500
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('emailAddress')}
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ 
                position: 'absolute', 
                left: isRtl ? 'auto' : '16px', 
                right: isRtl ? '16px' : 'auto', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'var(--text-muted)' 
              }}>
                <Mail size={18} />
              </span>
              <input
                type="email"
                className="input-field"
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ 
                  paddingLeft: isRtl ? '16px' : '48px', 
                  paddingRight: isRtl ? '48px' : '16px' 
                }}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                {t('password')}
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPasswordModal(true);
                  setForgotPasswordStep(1);
                  setForgotPasswordEmail('');
                  setForgotPasswordOtp('');
                  setForgotPasswordNewPassword('');
                  setForgotPasswordError(null);
                  setForgotPasswordSuccess(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary, #f5b731)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: 0,
                  outline: 'none'
                }}
                id="driver-forgot-password-link"
              >
                Forgot Password?
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{ 
                position: 'absolute', 
                left: isRtl ? 'auto' : '16px', 
                right: isRtl ? '16px' : 'auto', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'var(--text-muted)' 
              }}>
                <Lock size={18} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ 
                  paddingLeft: isRtl ? '48px' : '48px', 
                  paddingRight: isRtl ? '48px' : '48px' 
                }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: isRtl ? 'auto' : '16px',
                  left: isRtl ? '16px' : 'auto',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            style={{ marginTop: '8px', height: '48px' }}
            disabled={loading}
          >
            {loading ? t('authenticating') : t('signInAsDriver')}
          </button>
        </form>
      </div>

      {/* Footer info */}
      <p style={{ marginTop: '32px', fontSize: '12px', color: 'var(--text-muted)' }}>
        {t('authorizedPersonnelOnly')}
      </p>

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(6, 6, 14, 0.85)',
            backdropFilter: 'blur(16px)',
            zIndex: 10006,
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
              onClick={() => setShowForgotPasswordModal(false)}
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
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#f5b731' }}>Forgot Password</h2>
              <p style={{ fontSize: '0.9rem', color: '#a3a3a3', margin: 0 }}>
                {forgotPasswordStep === 1 
                  ? 'Enter your email to receive a 6-digit verification code.' 
                  : 'Enter the 6-digit code sent to your email and your new password.'}
              </p>
            </div>

            {forgotPasswordError && (
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
                {forgotPasswordError}
              </div>
            )}

            {forgotPasswordSuccess && (
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
                {forgotPasswordSuccess}
              </div>
            )}

            {forgotPasswordStep === 1 ? (
              <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="fp-email" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e5e7eb' }}>Email Address</label>
                  <input
                    id="fp-email"
                    type="email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      fontSize: '0.95rem',
                      background: 'rgba(255,255,255,0.03)',
                      color: 'white',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#f5b731'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotPasswordLoading}
                  style={{
                    background: '#f5b731',
                    color: '#06060e',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px',
                    fontWeight: 700,
                    fontSize: '1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'opacity 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  id="fp-request-otp-btn"
                >
                  {forgotPasswordLoading ? 'Sending...' : 'Send Reset Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="fp-otp" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e5e7eb' }}>6-Digit Code</label>
                  <input
                    id="fp-otp"
                    type="text"
                    maxLength={6}
                    value={forgotPasswordOtp}
                    onChange={(e) => setForgotPasswordOtp(e.target.value)}
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
                  <label htmlFor="fp-password" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e5e7eb' }}>New Password</label>
                  <input
                    id="fp-password"
                    type="password"
                    value={forgotPasswordNewPassword}
                    onChange={(e) => setForgotPasswordNewPassword(e.target.value)}
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
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#f5b731'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setForgotPasswordStep(1)}
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.05)',
                      color: 'white',
                      border: '1px solid rgba(255,255,255,0.1)',
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
                    disabled={forgotPasswordLoading}
                    style={{
                      flex: 2,
                      background: '#f5b731',
                      color: '#06060e',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      opacity: forgotPasswordLoading ? 0.7 : 1
                    }}
                    id="fp-reset-btn"
                  >
                    {forgotPasswordLoading ? 'Resetting...' : 'Reset Password'}
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
