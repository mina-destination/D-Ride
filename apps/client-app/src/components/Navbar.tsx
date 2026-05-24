import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LanguageContext';
import { Sun, Moon, User, Menu, X, MapPin, LogOut, Globe, Wallet } from 'lucide-react';
import logo from '../assets/d-ride-logo.jpeg';
import { useState, useEffect, useRef } from 'react';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
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
      <Link to="/" style={{ display: 'flex', alignItems: 'center' }} onClick={() => setIsOpen(false)}>
        <img src={logo} alt="D-Ride" className="nav-logo" />
      </Link>

      <button 
        className="mobile-menu-toggle" 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle Menu"
        aria-expanded={isOpen}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <ul className={`nav-links ${isOpen ? 'mobile-open' : ''}`}>
        <li>
          <a 
            href="/#how-it-works" 
            onClick={() => setIsOpen(false)}
            className={isHashActive('#how-it-works') ? 'nav-link-active' : ''}
          >
            {t('howItWorks')}
          </a>
        </li>
        <li>
          <a 
            href="/#features" 
            onClick={() => setIsOpen(false)}
            className={isHashActive('#features') ? 'nav-link-active' : ''}
          >
            {t('features')}
          </a>
        </li>
        <li>
          <Link 
            to="/routes" 
            onClick={() => setIsOpen(false)}
            className={isRouteActive('/routes') ? 'nav-link-active' : ''}
          >
            {t('routes')}
          </Link>
        </li>
        <li>
          <Link 
            to="/contact" 
            onClick={() => setIsOpen(false)}
            className={isRouteActive('/contact') ? 'nav-link-active' : ''}
          >
            {t('contactUs')}
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
                    <MapPin size={16} /> {t('myTrips')}
                  </Link>
                </li>
                <li>
                  <button 
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setIsOpen(false);
                      setIsProfileOpen(true);
                    }}
                    className="profile-menu-item"
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      width: '100%', 
                      textAlign: 'left', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <User size={16} /> {t('profile')}
                  </button>
                </li>
                <li>
                  <Link 
                    to="/wallet" 
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setIsOpen(false);
                    }}
                    className="profile-menu-item"
                  >
                    <Wallet size={16} /> {t('myWallet')}
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
                    <LogOut size={16} /> {t('signOut')}
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
        <li>
          <button 
            className="theme-toggle-btn"
            onClick={toggleTheme} 
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </li>
        <li>
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

      {isProfileOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6, 6, 14, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px',
          animation: 'fade-in 0.25s ease'
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '380px',
            padding: '30px 24px',
            borderRadius: '20px',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-md)',
            background: 'var(--surface-elevated)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            position: 'relative'
          }}>
            <button 
              onClick={() => setIsProfileOpen(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--primary)',
                color: 'var(--text-on-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 'bold',
                boxShadow: '0 0 15px rgba(245, 183, 49, 0.3)'
              }}>
                {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
              </div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                {user?.name || 'Commuter'}
              </h3>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-on-primary)',
                background: 'var(--primary)',
                padding: '4px 10px',
                borderRadius: '100px',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                {user?.role || 'PASSENGER'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email Address</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.email || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone Number</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.phone || 'N/A'}</span>
              </div>
              {user?.role === 'PASSENGER' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Wallet Balance</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--primary)' }}>
                    {user?.walletBalance !== undefined ? `${user.walletBalance} EGP` : '0 EGP'}
                  </span>
                </div>
              )}
            </div>

            <button 
              className="btn btn-secondary btn-block"
              onClick={() => setIsProfileOpen(false)}
              style={{ marginTop: '10px', padding: '12px' }}
            >
              Close Profile
            </button>
          </div>
        </div>
      )}
    </nav>

  );
}
