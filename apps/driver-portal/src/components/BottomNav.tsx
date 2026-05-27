import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, Navigation, User } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  // Hide bottom nav on login page
  if (location.pathname === '/login') {
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
      {/* Shifts tab */}
      <button
        onClick={() => navigate('/trips')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          background: isActive('/trips') ? 'rgba(245, 183, 49, 0.12)' : 'none',
          border: isActive('/trips') ? '1px solid rgba(245, 183, 49, 0.22)' : '1px solid transparent',
          borderRadius: '100px',
          color: isActive('/trips') ? 'var(--primary)' : 'var(--text-secondary)',
          fontWeight: isActive('/trips') ? 700 : 500,
          fontSize: '11px',
          cursor: 'pointer',
          flex: 1,
          padding: '6px 0',
          margin: '4px',
          transform: isActive('/trips') ? 'scale(1.03)' : 'scale(1)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: isActive('/trips') ? '0 4px 12px rgba(245, 183, 49, 0.08)' : 'none',
          height: 'calc(100% - 8px)',
          justifyContent: 'center'
        }}
      >
        <Calendar size={18} style={{ color: isActive('/trips') ? 'var(--primary)' : 'var(--text-muted)', transition: 'all 0.2s' }} />
        <span>{t('myShifts')}</span>
      </button>

      {/* active drive (hidden or inactive if not drive page) */}
      <button
        onClick={() => navigate('/trips')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          background: isActive('/drive') ? 'rgba(245, 183, 49, 0.12)' : 'none',
          border: isActive('/drive') ? '1px solid rgba(245, 183, 49, 0.22)' : '1px solid transparent',
          borderRadius: '100px',
          color: isActive('/drive') ? 'var(--primary)' : 'var(--text-secondary)',
          fontWeight: isActive('/drive') ? 700 : 500,
          fontSize: '11px',
          cursor: 'pointer',
          flex: 1,
          padding: '6px 0',
          margin: '4px',
          transform: isActive('/drive') ? 'scale(1.03)' : 'scale(1)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: isActive('/drive') ? '0 4px 12px rgba(245, 183, 49, 0.08)' : 'none',
          height: 'calc(100% - 8px)',
          justifyContent: 'center'
        }}
      >
        <Navigation size={18} style={{ color: isActive('/drive') ? 'var(--primary)' : 'var(--text-muted)', transition: 'all 0.2s' }} />
        <span>{t('activeMap')}</span>
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
