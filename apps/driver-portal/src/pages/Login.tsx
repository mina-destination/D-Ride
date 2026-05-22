import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, Eye, EyeOff, Globe } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t, language, setLanguage, isRtl } = useTranslation();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('password')}
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
    </div>
  );
}
