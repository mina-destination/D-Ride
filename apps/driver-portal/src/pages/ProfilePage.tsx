import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Mail, Phone, ShieldCheck, LogOut, Truck, Compass, Award, Star, Globe } from 'lucide-react';
import logo from '../assets/d-ride-logo.jpeg';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { t, language, setLanguage, isRtl } = useTranslation();
  const navigate = useNavigate();

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

      </div>
    </div>
  );
}
