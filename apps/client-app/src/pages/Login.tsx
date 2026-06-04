import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import logo from '../assets/d-ride-logo.jpeg';
import { LogIn, RefreshCw } from 'lucide-react';
import { authAPI } from '../services/api';
import SEO from '../components/SEO';

function decodeJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export default function LoginPage() {
  const { t, language } = useTranslation();
  const { login, loginWithGoogle } = useAuth();
  
  const isAr = language === 'ar';
  const seoTitle = isAr ? 'تسجيل الدخول | دي-رايد' : 'Sign In | D-Ride';
  const seoDescription = isAr
    ? 'سجل الدخول بأمان إلى حساب دي-رايد الخاص بك لإدارة وحجز التذاكر والرحلات اليومية.'
    : 'Securely sign in to your D-Ride passenger account to book tickets and manage your commutes.';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot Password States
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState(1);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordOtp, setForgotPasswordOtp] = useState('');
  const [forgotPasswordNewPassword, setForgotPasswordNewPassword] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState('');
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState('');

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordError('');
    setForgotPasswordSuccess('');
    setForgotPasswordLoading(true);
    try {
      await authAPI.forgotPassword(forgotPasswordEmail);
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
    setForgotPasswordError('');
    setForgotPasswordSuccess('');
    setForgotPasswordLoading(true);
    try {
      await authAPI.resetPassword({
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

  // Google Chooser States
  const [showGoogleChooser, setShowGoogleChooser] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');

  // Real Google Sign-In setup
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const isGoogleConfigured = clientId && clientId !== 'your_google_client_id_here';

    if (!isGoogleConfigured) return;

    const handleCredentialResponse = async (response: any) => {
      setGoogleLoading(true);
      setError('');
      try {
        const credential = response.credential;
        const payload = decodeJwt(credential);
        const email = payload?.email || '';
        const name = payload?.name || 'Google User';

        await loginWithGoogle({ email, name, googleId: credential });
        navigate(redirectTo);
      } catch (err: any) {
        setError(err?.message || 'Google Sign-In failed');
      } finally {
        setGoogleLoading(false);
      }
    };

    const initializeGoogle = () => {
      try {
        (window as any).google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
        });

        const btnContainer = document.getElementById('google-signin-btn');
        if (btnContainer) {
          btnContainer.innerHTML = ''; // prevent duplicate buttons
          (window as any).google.accounts.id.renderButton(
            btnContainer,
            { 
              theme: 'outline', 
              size: 'large', 
              text: 'continue_with', 
              shape: 'rectangular',
              width: btnContainer.clientWidth || 340
            }
          );
        }
      } catch (err) {
        console.error('Failed to initialize Google Sign-In:', err);
      }
    };

    if ((window as any).google?.accounts?.id) {
      initializeGoogle();
    } else {
      const interval = setInterval(() => {
        if ((window as any).google?.accounts?.id) {
          clearInterval(interval);
          initializeGoogle();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [loginWithGoogle, navigate]);

  const handleOpenGoogleChooser = () => {
    setShowGoogleChooser(true);
    setShowCustomForm(false);
    setCustomName('');
    setCustomEmail('');
  };

  const handleCloseGoogleChooser = () => {
    setShowGoogleChooser(false);
  };

  const handleSelectGoogleAccount = async (gmail: string, name: string) => {
    setGoogleLoading(true);
    setError('');
    try {
      // Simulate Google API token exchange latency
      await new Promise((resolve) => setTimeout(resolve, 800));

      const mockGoogleId = 'g-' + Math.random().toString(36).substring(2, 12);
      await loginWithGoogle({ email: gmail, name, googleId: mockGoogleId });
      setShowGoogleChooser(false);
      navigate(redirectTo);
    } catch (err: any) {
      setError(err?.message || 'Google Sign-In failed');
      setShowGoogleChooser(false);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleCustomGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail || !customName) return;
    handleSelectGoogleAccount(customEmail, customName);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(redirectTo);
    } catch (err: any) {
      setError(err?.message || t('invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <SEO title={seoTitle} description={seoDescription} />
      <div className="auth-card glass">
        <div className="auth-header">
          <img src={logo} alt="D-Ride" className="auth-logo" />
          <h1 className="auth-title">{t('loginTitle')}</h1>
          <p className="auth-subtitle">{t('loginSubtitle')}</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="email">{t('loginEmailLabel')}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('loginEmailPlaceholder')}
              required
            />
          </div>
          <div className="auth-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label htmlFor="password" style={{ margin: 0 }}>{t('loginPasswordLabel')}</label>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPasswordModal(true);
                  setForgotPasswordStep(1);
                  setForgotPasswordEmail('');
                  setForgotPasswordOtp('');
                  setForgotPasswordNewPassword('');
                  setForgotPasswordError('');
                  setForgotPasswordSuccess('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent, #f5b731)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  padding: 0,
                  outline: 'none'
                }}
                id="forgot-password-link"
              >
                Forgot Password?
              </button>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('loginPasswordPlaceholder')}
              required
            />
          </div>
          <button type="submit" className="btn-primary auth-btn" disabled={loading} id="login-submit-btn">
            {loading ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                {t('loggingIn')}
              </>
            ) : (
              <>
                <LogIn size={18} />
                {t('loginBtn')}
              </>
            )}
          </button>
        </form>

        {/* Divider OR */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0', width: '100%' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ margin: '0 10px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        {/* Google G-Button */}
        {import.meta.env.VITE_GOOGLE_CLIENT_ID && 
         import.meta.env.VITE_GOOGLE_CLIENT_ID !== 'your_google_client_id_here' ? (
          <div 
            id="google-signin-btn" 
            style={{ 
              width: '100%', 
              minHeight: '44px', 
              display: 'flex', 
              justifyContent: 'center', 
              marginTop: '0.5rem',
              borderRadius: '12px',
              overflow: 'hidden'
            }}
          />
        ) : (
          <button 
            type="button" 
            onClick={handleOpenGoogleChooser}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              width: '100%',
              padding: '0.75rem',
              background: 'white',
              color: '#1f2937',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 'bold',
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7v2.24h2.9c1.69-1.55 2.69-3.85 2.69-6.57z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.23l-2.91-2.24c-.8.54-1.84.87-3.05.87-2.34 0-4.33-1.58-5.03-3.7H.95v2.3C2.43 15.89 5.48 18 9 18z"/>
              <path fill="#FBBC05" d="M3.97 10.7c-.18-.54-.28-1.12-.28-1.7s.1-1.16.28-1.7V5H.95C.34 6.2.0 7.56.0 9s.34 2.8.95 4H3.97z"/>
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15 2.02C13.46.59 11.43 0 9 0 5.48 0 2.43 2.11.95 5.1L3.97 7.4c.7-2.12 2.69-3.7 5.03-3.7z"/>
            </svg>
            Continue with Google
          </button>
        )}

        <div className="auth-switch">
          {t('dontHaveAccount')} <Link to="/register">{t('signUpNow')}</Link>
        </div>
      </div>

      {/* Simulated Google Accounts Chooser Overlay */}
      {showGoogleChooser && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(6, 6, 14, 0.85)',
            backdropFilter: 'blur(16px)',
            zIndex: 10005,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div 
            style={{
              background: '#ffffff',
              color: '#1f2937',
              borderRadius: '24px',
              padding: '2.5rem 2rem',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
              position: 'relative'
            }}
          >
            <button 
              onClick={handleCloseGoogleChooser}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#f3f4f6',
                border: 'none',
                color: '#4b5563',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              ✕
            </button>

            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <svg width="40" height="40" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#111827' }}>Choose an account</h2>
              <p style={{ fontSize: '0.9rem', color: '#4b5563', margin: 0 }}>to continue to <strong>D-Ride Commuter</strong></p>
            </div>

            {googleLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  border: '3px solid #e5e7eb',
                  borderTopColor: '#4285F4',
                  borderRadius: '50%',
                  margin: '0 auto 1.5rem auto',
                  animation: 'spin 1s linear infinite'
                }} />
                <p style={{ fontSize: '0.9rem', color: '#4b5563', fontWeight: 600 }}>Securing single sign-on connection...</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {!showCustomForm ? (
                  <>
                    {[
                      { name: 'Ahmed Hassan', email: 'ahmed@gmail.com', avatar: 'AH' },
                      { name: 'Omar Khaled', email: 'omar.khaled@gmail.com', avatar: 'OK' }
                    ].map((acc) => (
                      <button
                        key={acc.email}
                        onClick={() => handleSelectGoogleAccount(acc.email, acc.name)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          width: '100%',
                          padding: '12px 16px',
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      >
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: '#4285F4',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '0.85rem'
                        }}>
                          {acc.avatar}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>{acc.name}</span>
                          <span style={{ fontSize: '0.75rem', color: '#4b5563' }}>{acc.email}</span>
                        </div>
                      </button>
                    ))}

                    <button
                      onClick={() => setShowCustomForm(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        width: '100%',
                        padding: '12px',
                        background: 'transparent',
                        border: '1px dashed #d1d5db',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        color: '#4b5563',
                        marginTop: '0.25rem',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                        e.currentTarget.style.borderColor = '#9ca3af';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = '#d1d5db';
                      }}
                    >
                      Use another account
                    </button>
                  </>
                ) : (
                  <form onSubmit={handleCustomGoogleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4b5563' }}>Google Name</label>
                      <input
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="Ahmed Hassan"
                        required
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          background: 'white',
                          color: '#1f2937',
                          outline: 'none'
                        }}
                      />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4b5563' }}>Google Email Address</label>
                      <input
                        type="email"
                        value={customEmail}
                        onChange={(e) => setCustomEmail(e.target.value)}
                        placeholder="you@gmail.com"
                        required
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          background: 'white',
                          color: '#1f2937',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setShowCustomForm(false)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          background: '#f3f4f6',
                          color: '#4b5563',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.88rem'
                        }}
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        style={{
                          flex: 2,
                          padding: '10px',
                          background: '#4285F4',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '0.88rem'
                        }}
                      >
                        Verify & Continue
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
            
            <div style={{ borderTop: '1px solid #f3f4f6', marginTop: '2rem', paddingTop: '1rem', fontSize: '0.75rem', color: '#6b7280', textAlign: 'center', lineHeight: 1.4 }}>
              To continue, Google will share your name, email address, and profile picture with D-Ride.
            </div>
          </div>
        </div>
      )}

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
