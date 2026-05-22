import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, Navigation } from 'lucide-react';
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
      bottom: 0,
      left: 0,
      right: 0,
      height: 'var(--nav-height)',
      background: 'rgba(14, 14, 27, 0.9)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      zIndex: 100,
      paddingBottom: 'safe-area-inset-bottom'
    }}>
      {/* Shifts tab */}
      <button
        onClick={() => navigate('/trips')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          background: 'none',
          border: 'none',
          color: isActive('/trips') ? 'var(--primary)' : 'var(--text-secondary)',
          fontWeight: isActive('/trips') ? 700 : 500,
          fontSize: '12px',
          cursor: 'pointer',
          flex: 1
        }}
      >
        <Calendar size={22} style={{ color: isActive('/trips') ? 'var(--primary)' : 'var(--text-muted)' }} />
        <span>{t('myShifts')}</span>
      </button>

      {/* active drive (hidden or inactive if not drive page) */}
      <button
        onClick={() => navigate('/trips')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          background: 'none',
          border: 'none',
          color: isActive('/drive') ? 'var(--primary)' : 'var(--text-secondary)',
          fontWeight: isActive('/drive') ? 700 : 500,
          fontSize: '12px',
          cursor: 'pointer',
          flex: 1
        }}
      >
        <Navigation size={22} style={{ color: isActive('/drive') ? 'var(--primary)' : 'var(--text-muted)' }} />
        <span>{t('activeMap')}</span>
      </button>
    </div>
  );
}
