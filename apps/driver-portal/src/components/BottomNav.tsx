import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, User, Phone } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  // Hide bottom nav on login page and active driving view
  if (location.pathname === '/login' || location.pathname.startsWith('/drive/')) {
    return null;
  }

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div style={{
      position: 'fixed',
      bottom: '1.25rem',
      left: '5%',
      right: '5%',
      width: '90%',
      maxWidth: '450px',
      margin: '0 auto',
      height: 'var(--nav-height)',
      background: 'rgba(14, 14, 27, 0.65)',
      backdropFilter: 'blur(20px) saturate(1.6)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '100px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      zIndex: 100,
      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
      padding: '0 8px'
    }}>
      {/* Dashboard tab */}
      <button
        onClick={() => navigate('/dashboard')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          background: isActive('/dashboard') ? 'rgba(245, 183, 49, 0.12)' : 'none',
          border: isActive('/dashboard') ? '1px solid rgba(245, 183, 49, 0.22)' : '1px solid transparent',
          borderRadius: '100px',
          color: isActive('/dashboard') ? 'var(--primary)' : 'var(--text-secondary)',
          fontWeight: isActive('/dashboard') ? 700 : 500,
          fontSize: '11px',
          cursor: 'pointer',
          flex: 1,
          padding: '6px 0',
          margin: '4px',
          transform: isActive('/dashboard') ? 'scale(1.03)' : 'scale(1)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: isActive('/dashboard') ? '0 4px 12px rgba(245, 183, 49, 0.08)' : 'none',
          height: 'calc(100% - 8px)',
          justifyContent: 'center'
        }}
      >
        <Calendar size={18} style={{ color: isActive('/dashboard') ? 'var(--primary)' : 'var(--text-muted)', transition: 'all 0.2s' }} />
        <span>{t('dashboard')}</span>
      </button>

      {/* Help Tab */}
      <button
        onClick={() => navigate('/help')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          background: isActive('/help') ? 'rgba(245, 183, 49, 0.12)' : 'none',
          border: isActive('/help') ? '1px solid rgba(245, 183, 49, 0.22)' : '1px solid transparent',
          borderRadius: '100px',
          color: isActive('/help') ? 'var(--primary)' : 'var(--text-secondary)',
          fontWeight: isActive('/help') ? 700 : 500,
          fontSize: '11px',
          cursor: 'pointer',
          flex: 1,
          padding: '6px 0',
          margin: '4px',
          transform: isActive('/help') ? 'scale(1.03)' : 'scale(1)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: isActive('/help') ? '0 4px 12px rgba(245, 183, 49, 0.08)' : 'none',
          height: 'calc(100% - 8px)',
          justifyContent: 'center'
        }}
      >
        <Phone size={18} style={{ color: isActive('/help') ? 'var(--primary)' : 'var(--text-muted)', transition: 'all 0.2s' }} />
        <span>{t('help')}</span>
      </button>

      {/* Profile tab */}
      <button
        onClick={() => navigate('/profile')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          background: isActive('/profile') ? 'rgba(245, 183, 49, 0.12)' : 'none',
          border: isActive('/profile') ? '1px solid rgba(245, 183, 49, 0.22)' : '1px solid transparent',
          borderRadius: '100px',
          color: isActive('/profile') ? 'var(--primary)' : 'var(--text-secondary)',
          fontWeight: isActive('/profile') ? 700 : 500,
          fontSize: '11px',
          cursor: 'pointer',
          flex: 1,
          padding: '6px 0',
          margin: '4px',
          transform: isActive('/profile') ? 'scale(1.03)' : 'scale(1)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: isActive('/profile') ? '0 4px 12px rgba(245, 183, 49, 0.08)' : 'none',
          height: 'calc(100% - 8px)',
          justifyContent: 'center'
        }}
      >
        <User size={18} style={{ color: isActive('/profile') ? 'var(--primary)' : 'var(--text-muted)', transition: 'all 0.2s' }} />
        <span>{t('profile')}</span>
      </button>
    </div>
  );
}
