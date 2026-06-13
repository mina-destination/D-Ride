import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogOut, Globe, Bell, ArrowLeft, RefreshCw, User, Calendar, MapPin, Phone, ShieldCheck, ChevronRight } from 'lucide-react';
import logo from '../assets/d-ride-logo.jpeg';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  backPath?: string;
  onRefresh?: () => void;
  loadingRefresh?: boolean;
  showNotifications?: boolean;
  onNotificationClick?: () => void;
}

export default function Header({
  title,
  subtitle,
  showBack = false,
  backPath,
  onRefresh,
  loadingRefresh = false,
  showNotifications = false,
  onNotificationClick
}: HeaderProps) {
  const { user, logout } = useAuth();
  const { t, language, setLanguage, isRtl } = useTranslation();
  const { notifications } = useNotifications();
  const navigate = useNavigate();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setIsDropdownOpen(false);
    logout();
    navigate('/login');
  };

  const handleBack = () => {
    if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1);
    }
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

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="floating-header" style={{
      background: 'rgba(14, 14, 27, 0.85)',
      backdropFilter: 'blur(20px) saturate(1.6)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '10px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'sticky',
      top: '0',
      zIndex: 100,
      margin: '0',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
      minWidth: 0
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
        {showBack ? (
          <button
            onClick={handleBack}
            style={{
              color: 'var(--text-primary)',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              minWidth: '32px',
              minHeight: '32px'
            }}
            title={t('back') || 'Back'}
          >
            <ArrowLeft size={20} style={{ transform: isRtl ? 'rotate(180deg)' : 'none' }} />
          </button>
        ) : (
          <img src={logo} alt="Logo" style={{ height: '28px', width: '28px', borderRadius: '6px', objectFit: 'contain', boxShadow: '0 0 8px rgba(245, 183, 49, 0.3)', flexShrink: 0 }} />
        )}
        <div style={{ minWidth: 0, overflow: 'hidden' }}>
          <h2 className="title-outfit" style={{ fontSize: '13px', margin: 0, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title || t('helloDriver', { name: user?.name || 'Driver' })}
          </h2>
          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
            {subtitle !== undefined ? subtitle : t('cairoRegionFleet')}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0, position: 'relative' }} ref={dropdownRef}>
        {showNotifications && (
          <button
            onClick={onNotificationClick}
            style={{ position: 'relative', color: 'var(--text-secondary)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', padding: '4px', minWidth: '32px', minHeight: '32px', justifyContent: 'center' }}
            title="Notifications"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '0px',
                right: '0px',
                background: 'var(--primary)',
                color: 'black',
                borderRadius: '50%',
                width: '14px',
                height: '14px',
                fontSize: '9px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {unreadCount}
              </span>
            )}
          </button>
        )}

        {onRefresh && (
          <button
            onClick={onRefresh}
            style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', padding: '4px', minWidth: '32px', minHeight: '32px', justifyContent: 'center' }}
            title={t('refreshTrips') || 'Refresh'}
          >
            <RefreshCw size={16} className={loadingRefresh ? 'spin-anim' : ''} />
          </button>
        )}

        <button
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', padding: '4px', minWidth: '32px', minHeight: '32px', justifyContent: 'center' }}
          title={language === 'en' ? 'العربية' : 'English'}
        >
          <Globe size={16} />
        </button>

        {/* Profile Dropdown Trigger */}
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
            color: 'var(--text-on-primary)',
            fontSize: '12px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            marginLeft: '4px'
          }}
          title={user?.name || 'Driver Profile'}
        >
          {getInitials()}
        </button>

        {/* Profile Dropdown Panel */}
        {isDropdownOpen && (
          <div style={{
            position: 'absolute',
            top: '40px',
            right: isRtl ? 'auto' : '0px',
            left: isRtl ? '0px' : 'auto',
            background: 'rgba(22, 22, 40, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            width: '240px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            zIndex: 10006,
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {/* User details header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(245, 183, 49, 0.12)',
                color: 'var(--primary)',
                fontSize: '13px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(245, 183, 49, 0.25)'
              }}>
                {getInitials()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {user?.name || 'Driver Captain'}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {user?.email || 'driver@dride.com'}
                </span>
              </div>
            </div>

            {/* Badge */}
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '9px',
              fontWeight: 700,
              color: 'var(--success)',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              alignSelf: 'flex-start'
            }}>
              <ShieldCheck size={10} />
              Verified Driver
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

            {/* Menu options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <Link to="/dashboard" onClick={() => setIsDropdownOpen(false)} style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', gap: '8px', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', color: 'var(--text-primary)', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ flex: 1 }}>{t('dashboard') || 'Dashboard'}</span>
                <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
              </Link>

              <Link to="/trips" onClick={() => setIsDropdownOpen(false)} style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', gap: '8px', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', color: 'var(--text-primary)', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <MapPin size={14} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ flex: 1 }}>{t('myTrips') || 'My Trips'}</span>
                <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
              </Link>

              <Link to="/profile" onClick={() => setIsDropdownOpen(false)} style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', gap: '8px', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', color: 'var(--text-primary)', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <User size={14} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ flex: 1 }}>{t('profile') || 'Profile'}</span>
                <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
              </Link>

              <Link to="/help" onClick={() => setIsDropdownOpen(false)} style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', gap: '8px', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', color: 'var(--text-primary)', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <Phone size={14} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ flex: 1 }}>{t('help') || 'Help'}</span>
                <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
              </Link>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'var(--danger)',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <LogOut size={14} />
              <span style={{ flex: 1 }}>{t('signOut')}</span>
              <ChevronRight size={12} style={{ color: 'var(--danger)', opacity: 0.5 }} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
