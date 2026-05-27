import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LanguageContext';
import { Sun, Moon, User, Menu, X, MapPin, LogOut, Globe, Bell, HelpCircle, Sparkles, Map, Handshake, Mail, ChevronRight } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNotifications } from '../context/NotificationContext';
import logo from '../assets/d-ride-logo.jpeg';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const { notifications, markRead, markAllRead } = useNotifications();

  const dropdownRef = useRef<HTMLLIElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (['/login', '/register'].includes(location.pathname)) {
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    setIsOpen(false);
    if (location.pathname === '/') {
      e.preventDefault();
      const element = document.getElementById(hash.replace('#', ''));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  // Local handlers removed, context handlers used directly

  // Helper to check if a hash-link is active (for anchor sections on home page)
  const isHashActive = (hash: string) => {
    return location.pathname === '/' && location.hash === hash;
  };

  // Helper to check if a route-link is active
  const isRouteActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="nav">
      <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }} onClick={() => setIsOpen(false)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src={logo} alt="D-Ride Logo" style={{ height: '38px', width: 'auto', borderRadius: '6px', objectFit: 'contain', boxShadow: '0 0 15px rgba(245, 183, 49, 0.4)', flexShrink: 0 }} />
        </div>
      </Link>

      <div className="nav-right-actions">
        {isAuthenticated && (
          <div className="notification-dropdown-container" ref={notificationRef}>
            <button 
              className="notification-bell-btn" 
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              aria-label="Notifications"
              aria-expanded={isNotificationOpen}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <Bell size={18} />
              {notifications.some(n => !n.read) && (
                <span className="notification-badge" />
              )}
            </button>
            
            <div className={`notification-dropdown ${isNotificationOpen ? 'open' : ''}`}>
              <div className="notification-dropdown-header">
                <span>{t('notifications')}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); markAllRead(); }}
                  className="mark-all-read-btn"
                >
                  {t('markAllRead')}
                </button>
              </div>
              <hr className="profile-divider" />
              <ul className="notification-dropdown-list">
                {notifications.length === 0 ? (
                  <li className="notification-empty">{t('noNotifications')}</li>
                ) : (
                  notifications.map(item => (
                    <li 
                      key={item.id} 
                      className={`notification-dropdown-item ${item.read ? 'read' : 'unread'}`}
                      onClick={() => markRead(item.id)}
                    >
                      <div className="notification-item-title">{item.title}</div>
                      <div className="notification-item-desc">{item.description}</div>
                      <div className="notification-item-time">{item.time}</div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        )}

        <button 
          className="mobile-menu-toggle" 
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle Menu"
          aria-expanded={isOpen}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <ul className={`nav-links ${isOpen ? 'mobile-open' : ''}`}>
        <li>
          <Link 
            to="/#how-it-works" 
            onClick={(e) => handleAnchorClick(e, '#how-it-works')}
            className={isHashActive('#how-it-works') ? 'nav-link-active' : ''}
          >
            <HelpCircle size={16} className="nav-mobile-icon" />
            <span>{t('howItWorks')}</span>
          </Link>
        </li>
        <li>
          <Link 
            to="/#features" 
            onClick={(e) => handleAnchorClick(e, '#features')}
            className={isHashActive('#features') ? 'nav-link-active' : ''}
          >
            <Sparkles size={16} className="nav-mobile-icon" />
            <span>{t('features')}</span>
          </Link>
        </li>
        <li>
          <Link 
            to="/routes" 
            onClick={() => setIsOpen(false)}
            className={isRouteActive('/routes') ? 'nav-link-active' : ''}
          >
            <Map size={16} className="nav-mobile-icon" />
            <span>{t('routes')}</span>
          </Link>
        </li>
        <li>
          <Link 
            to="/partners" 
            onClick={() => setIsOpen(false)}
            className={isRouteActive('/partners') ? 'nav-link-active' : ''}
          >
            <Handshake size={16} className="nav-mobile-icon" />
            <span>{t('partners')}</span>
          </Link>
        </li>
        <li>
          <Link 
            to="/contact" 
            onClick={() => setIsOpen(false)}
            className={isRouteActive('/contact') ? 'nav-link-active' : ''}
          >
            <Mail size={16} className="nav-mobile-icon" />
            <span>{t('contactUs')}</span>
          </Link>
        </li>
        {isAuthenticated ? (
          <li className="profile-dropdown-container" ref={dropdownRef}>
            <button 
              className="profile-avatar-btn" 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-label="User profile"
              aria-expanded={isDropdownOpen}
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : <User size={18} />}
            </button>
            
            <div className={`profile-dropdown ${isDropdownOpen ? 'open' : ''}`}>
              <div className="profile-dropdown-header">
                <div className="profile-dropdown-avatar">
                  {user?.name ? user.name.charAt(0).toUpperCase() : <User size={16} />}
                </div>
                <div className="profile-dropdown-info">
                  <span className="profile-name">{user?.name}</span>
                  <span className="profile-email">{user?.email}</span>
                </div>
              </div>
              <hr className="profile-divider" />
              <ul className="profile-dropdown-menu">
                <li>
                  <Link 
                    to="/my-trips" 
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setIsOpen(false);
                    }}
                    className="profile-menu-item"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <MapPin size={16} /> <span>{t('myTrips')}</span>
                    </div>
                    <ChevronRight size={14} className="profile-menu-chevron" />
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/profile" 
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setIsOpen(false);
                    }}
                    className="profile-menu-item"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <User size={16} /> <span>{t('profile')}</span>
                    </div>
                    <ChevronRight size={14} className="profile-menu-chevron" />
                  </Link>
                </li>

                <li>
                  <button 
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setIsOpen(false);
                      handleLogout();
                    }}
                    className="profile-menu-item logout-btn"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <LogOut size={16} /> <span>{t('signOut')}</span>
                    </div>
                    <ChevronRight size={14} className="profile-menu-chevron" />
                  </button>
                </li>
              </ul>
            </div>
          </li>
        ) : (
          <>
            <li><Link to="/login" className="nav-secondary" onClick={() => setIsOpen(false)}>{t('signIn')}</Link></li>
            <li><Link to="/register" className="nav-cta" onClick={() => setIsOpen(false)}>{t('getStarted')}</Link></li>
          </>
        )}
        <li className="nav-actions-item">
          <button 
            className="theme-toggle-btn"
            onClick={toggleTheme} 
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button 
            className="lang-toggle-btn"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')} 
            title="Switch Language / تغيير اللغة"
          >
            <Globe size={14} />
            <span>{language === 'en' ? 'العربية' : 'EN'}</span>
          </button>
        </li>
      </ul>

      {/* Profile modal removed in favor of standalone /profile route */}
    </nav>

  );
}
