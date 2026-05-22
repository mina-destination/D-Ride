import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import logo from '../assets/d-ride-logo.jpeg';
import { LayoutDashboard, Map, Bus, CarFront, UserCog, Ticket, CreditCard, Users, Settings, Search, Sun, Moon, Bell, Mail, LogOut, Shield } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

const navItems = [
  { label: 'Main', type: 'section' as const },
  { path: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { path: '/routes', icon: <Map size={18} />, label: 'Routes' },
  { path: '/trips', icon: <Bus size={18} />, label: 'Trips' },
  { path: '/vehicles', icon: <CarFront size={18} />, label: 'Vehicles' },
  { path: '/drivers', icon: <UserCog size={18} />, label: 'Drivers' },
  { label: 'Transactions', type: 'section' as const },
  { path: '/bookings', icon: <Ticket size={18} />, label: 'Bookings' },
  { path: '/payments', icon: <CreditCard size={18} />, label: 'Payments' },
  { label: 'System', type: 'section' as const },
  { path: '/passengers', icon: <Users size={18} />, label: 'Passengers' },
  { path: '/crm', icon: <Users size={18} />, label: 'User CRM' },
  { path: '/administrators', icon: <Shield size={18} />, label: 'Administrators' },
  { path: '/settings', icon: <Settings size={18} />, label: 'Settings' },
];

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/routes': 'Routes',
  '/trips': 'Trips',
  '/vehicles': 'Vehicles',
  '/drivers': 'Drivers',
  '/bookings': 'Bookings',
  '/payments': 'Payments',
  '/passengers': 'Passengers',
  '/crm': 'User CRM',
  '/administrators': 'Administrators',
  '/settings': 'Settings',
};

const pathPermissionMap: Record<string, string> = {
  '/': 'dashboard',
  '/routes': 'routes',
  '/trips': 'trips',
  '/vehicles': 'vehicles',
  '/drivers': 'drivers',
  '/bookings': 'bookings',
  '/payments': 'payments',
  '/passengers': 'passengers',
  '/crm': 'crm',
  '/administrators': 'settings',
  '/settings': 'settings',
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
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

  const currentTitle = pageTitles[location.pathname] || 'Dashboard';
  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'AD';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Filter navItems based on permissions
  const filteredNavItems = navItems.reduce<(typeof navItems[number])[]>((acc, item) => {
    if ('type' in item && item.type === 'section') {
      acc.push(item);
    } else {
      const permission = pathPermissionMap[item.path!];
      const isOwner = user?.role === 'OWNER';
      const hasPermission = user?.permissions?.includes(permission);
      
      if (isOwner || hasPermission) {
        acc.push(item);
      }
    }
    return acc;
  }, []);

  // Remove empty sections
  const finalNavItems = filteredNavItems.filter((item, idx, arr) => {
    if ('type' in item && item.type === 'section') {
      for (let i = idx + 1; i < arr.length; i++) {
        const nextItem = arr[i];
        if (!('type' in nextItem)) {
          return true;
        }
        if ('type' in nextItem && nextItem.type === 'section') {
          return false;
        }
      }
      return false;
    }
    return true;
  });

  return (
    <div className="dashboard-layout">
      {/* ── Sidebar ────────────────────────────────────── */}
      <aside className="sidebar">
          <div className="sidebar-header">
            <img src={logo} alt="D-Ride" className="sidebar-logo" />
            <span className="sidebar-brand-text">D-Ride</span>
          </div>

        <nav className="sidebar-nav">
          {finalNavItems.map((item, i) =>
            'type' in item && item.type === 'section' ? (
              <div key={i} className="sidebar-section-label">{item.label}</div>
            ) : (
              <NavLink
                key={item.path}
                to={item.path!}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `sidebar-item${isActive ? ' active' : ''}`
                }
              >
                <span className="sidebar-item-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ),
          )}
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-footer-text">Operated by Destination</span>
        </div>
      </aside>

      {/* ── Main Content ───────────────────────────────── */}
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <h2 className="topbar-title">{currentTitle}</h2>
          </div>
          <div className="topbar-search">
            <span><Search size={16} /></span>
            <input type="text" placeholder="Search routes, trips, drivers..." />
          </div>
          <div className="topbar-right">
            <button className="topbar-icon-btn" onClick={toggleTheme} title="Toggle Theme" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="topbar-icon-btn" title="Notifications" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={18} />
              <span className="topbar-badge" />
            </button>
            <button className="topbar-icon-btn" title="Messages" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mail size={18} />
            </button>
            <div className="profile-dropdown-container" ref={dropdownRef}>
              <div
                className="topbar-avatar"
                title={user?.name || 'Admin'}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                style={{ cursor: 'pointer' }}
              >
                {initials}
              </div>
              
              <div className={`profile-dropdown ${isDropdownOpen ? 'open' : ''}`}>
                <div className="profile-dropdown-header">
                  <div className="profile-dropdown-avatar">
                    {initials}
                  </div>
                  <div className="profile-dropdown-info">
                    <span className="profile-name">{user?.name || 'Admin'}</span>
                    <span className="profile-email">{user?.email || 'admin@d-ride.com'}</span>
                  </div>
                </div>
                <hr className="profile-divider" />
                <ul className="profile-dropdown-menu">
                  <li>
                    <NavLink 
                      to="/settings" 
                      onClick={() => setIsDropdownOpen(false)}
                      className="profile-menu-item"
                    >
                      <Settings size={16} /> Settings
                    </NavLink>
                  </li>
                  <li>
                    <button 
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleLogout();
                      }}
                      className="profile-menu-item logout-btn"
                    >
                      <LogOut size={16} /> Sign Out
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </header>

        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
