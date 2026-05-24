import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import logo from '../assets/d-ride-logo.jpeg';
import { LayoutDashboard, Map, Bus, CarFront, UserCog, Ticket, CreditCard, Users, Settings, Search, Sun, Moon, Bell, Mail, LogOut, Shield, Megaphone, LifeBuoy, Handshake, User } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Modal, Popover, List, Tag, Button } from 'antd';

const navItems = [
  { label: 'Overview', type: 'section' as const },
  { path: '/', icon: <LayoutDashboard size={18} />, label: 'Analytics' },
  
  { label: 'Fleet Operations', type: 'section' as const },
  { path: '/routes', icon: <Map size={18} />, label: 'Network Routes' },
  { path: '/trips', icon: <Bus size={18} />, label: 'Trip Schedules' },
  { path: '/vehicles', icon: <CarFront size={18} />, label: 'Vehicle Fleet' },
  { path: '/drivers', icon: <UserCog size={18} />, label: 'Driver Partners' },
  
  { label: 'Customer Relations', type: 'section' as const },
  { path: '/passengers', icon: <Users size={18} />, label: 'Passenger Registry' },
  { path: '/crm', icon: <Megaphone size={18} />, label: 'Marketing CRM' },
  { path: '/support-tickets', icon: <LifeBuoy size={18} />, label: 'Support Center' },
  
  { label: 'Finance & Sales', type: 'section' as const },
  { path: '/bookings', icon: <Ticket size={18} />, label: 'Reservations' },
  { path: '/payments', icon: <CreditCard size={18} />, label: 'Transactions' },
  
  { label: 'Administration', type: 'section' as const },
  { path: '/administrators', icon: <Shield size={18} />, label: 'Staff Access' },
  { path: '/settings', icon: <Settings size={18} />, label: 'System Settings' },
  { path: '/partners', icon: <Handshake size={18} />, label: 'Brand Partners' },
];

const pageTitles: Record<string, string> = {
  '/': 'Analytics Overview',
  '/routes': 'Network Routes',
  '/trips': 'Trip Schedules',
  '/vehicles': 'Vehicle Fleet',
  '/drivers': 'Driver Partners',
  '/bookings': 'Reservations',
  '/payments': 'Transactions',
  '/passengers': 'Passenger Registry',
  '/crm': 'Marketing CRM',
  '/support-tickets': 'Support Center',
  '/administrators': 'Staff Access Control',
  '/settings': 'System Settings',
  '/partners': 'Brand Partners',
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
  '/support-tickets': 'crm',
  '/administrators': 'settings',
  '/settings': 'settings',
  '/partners': 'settings',
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'New Booking Confirmed', description: 'Passenger Hassan Ali booked Cairo to Alexandria (Seat #3)', time: '2 mins ago', read: false },
    { id: 2, title: 'New Support Chat', description: 'Real-time ticket chat received from Hassan Ali', time: '10 mins ago', read: false },
    { id: 3, title: 'Driver Checked-In', description: 'Youssef Ibrahim checked in passenger Ahmed Mansour', time: '1 hour ago', read: true },
    { id: 4, title: 'Vehicle Status Changed', description: 'Toyota HiAce (ط ر ق ٥٤٣٢) updated to Maintenance', time: '3 hours ago', read: true }
  ]);
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
            <Popover
              content={
                <div style={{ width: '320px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                    <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>System Notifications</strong>
                    <Button type="link" size="small" onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))} style={{ padding: 0, color: 'var(--primary-color)' }}>
                      Mark all read
                    </Button>
                  </div>
                  <List
                    itemLayout="horizontal"
                    dataSource={notifications}
                    renderItem={item => (
                      <List.Item 
                        style={{ 
                          padding: '8px 8px', 
                          cursor: 'pointer', 
                          borderRadius: '6px',
                          marginBottom: '4px',
                          transition: 'background 0.2s',
                          background: item.read ? 'transparent' : 'rgba(245, 183, 49, 0.08)' 
                        }}
                        onClick={() => {
                          setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
                        }}
                      >
                        <List.Item.Meta
                          title={<span style={{ fontWeight: item.read ? 500 : 700, fontSize: '13px', color: 'var(--text-primary)' }}>{item.title}</span>}
                          description={
                            <div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.3', margin: '2px 0' }}>{item.description}</div>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.time}</span>
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </div>
              }
              trigger="click"
              placement="bottomRight"
              overlayClassName="glass-popover"
            >
              <button className="topbar-icon-btn" title="Notifications" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <Bell size={18} />
                {notifications.some(n => !n.read) && (
                  <span className="topbar-badge" style={{ position: 'absolute', top: '10px', right: '10px', background: 'var(--danger-color)', width: '8px', height: '8px', borderRadius: '50%' }} />
                )}
              </button>
            </Popover>
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
                    <button 
                      onClick={() => {
                        setIsDropdownOpen(false);
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
                        gap: '8px',
                        padding: '10px 16px',
                        color: 'var(--text-primary)',
                        fontSize: '14px'
                      }}
                    >
                      <User size={16} style={{ color: 'var(--text-secondary)' }} /> My Profile
                    </button>
                  </li>
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

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 'bold' }}>
            <User size={20} style={{ color: 'var(--primary-color)' }} /> Administrator Profile
          </div>
        }
        open={isProfileOpen}
        onCancel={() => setIsProfileOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setIsProfileOpen(false)} style={{ background: 'var(--primary-color)' }}>
            Close Profile
          </Button>
        ]}
        destroyOnClose
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', margin: '1rem 0 2rem 0', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--primary-color)',
            color: 'black',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: 'bold',
            boxShadow: '0 0 15px rgba(245, 183, 49, 0.3)'
          }}>
            {initials}
          </div>
          <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-primary)', fontWeight: 800 }}>
            {user?.name || 'Admin'}
          </h2>
          <Tag color="gold" style={{ fontWeight: 'bold', fontSize: '12px', padding: '2px 10px', borderRadius: '100px' }}>
            {user?.role || 'ADMIN'}
          </Tag>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Email Address</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.email || 'admin@d-ride.com'}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Account Permissions</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {user?.role === 'OWNER' ? (
                <Tag color="purple" style={{ fontWeight: 600 }}>All (Full System Bypass)</Tag>
              ) : user?.permissions && user.permissions.length > 0 ? (
                user.permissions.map((perm: string) => (
                  <Tag key={perm} color="blue" style={{ fontWeight: 600 }}>{perm}</Tag>
                ))
              ) : (
                <Tag color="default">None Assigned</Tag>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
