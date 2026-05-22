import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LanguageContext';
import { Sun, Moon, User, Menu, X, MapPin, LogOut, Globe } from 'lucide-react';
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

  return (
    <nav className="nav">
      <Link to="/" style={{ display: 'flex', alignItems: 'center' }} onClick={() => setIsOpen(false)}>
        <img src={logo} alt="D-Ride" className="nav-logo" />
      </Link>

      <button 
        className="mobile-menu-toggle" 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle Menu"
        style={{
          display: 'none',
          background: 'none',
          border: 'none',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '4px',
        }}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <ul className={`nav-links ${isOpen ? 'mobile-open' : ''}`}>
        <li><a href="/#how-it-works" onClick={() => setIsOpen(false)}>{t('howItWorks')}</a></li>
        <li><a href="/#features" onClick={() => setIsOpen(false)}>{t('features')}</a></li>
        <li><a href="/#routes" onClick={() => setIsOpen(false)}>{t('routes')}</a></li>
        <li><Link to="/contact" onClick={() => setIsOpen(false)}>{t('contactUs')}</Link></li>
        {isAuthenticated ? (
          <li className="profile-dropdown-container" ref={dropdownRef}>
            <button 
              className="profile-avatar-btn" 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-label="User profile"
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
            <li><Link to="/login" onClick={() => setIsOpen(false)}>{t('signIn')}</Link></li>
            <li><Link to="/register" className="nav-cta" onClick={() => setIsOpen(false)}>{t('getStarted')}</Link></li>
          </>
        )}
        <li>
          <button 
            className="theme-toggle-btn"
            onClick={toggleTheme} 
            title="Toggle Theme"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </li>
        <li>
          <button 
            className="theme-toggle-btn"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')} 
            title="Switch Language / تغيير اللغة"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '11px',
              border: '1px solid var(--border)',
              padding: '6px 10px',
              borderRadius: '8px',
              height: '38px',
              color: 'var(--text-primary)',
              gap: '4px'
            }}
          >
            <Globe size={14} />
            <span>{language === 'en' ? 'العربية' : 'EN'}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
