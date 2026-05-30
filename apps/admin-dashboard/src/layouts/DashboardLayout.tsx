import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LayoutDashboard, Map, Bus, CarFront, UserCog, Ticket, CreditCard, Users, Settings, Search, Sun, Moon, Bell, Mail, LogOut, Shield, Megaphone, LifeBuoy, Handshake, User, Menu, BarChart3, Undo2, Calculator } from 'lucide-react';
import logo from '../assets/d-ride-logo.jpeg';
import favicon from '../assets/favicon.png';
import { useState, useEffect, useRef } from 'react';
import { Popover, List, Button } from 'antd';
import { routesAPI, vehiclesAPI, usersAPI } from '../services/api';

const navItems = [
  { label: 'Overview', type: 'section' as const },
  { path: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  
  { label: 'Fleet Operations', type: 'section' as const },
  { path: '/routes', icon: <Map size={18} />, label: 'Routes' },
  { path: '/trips', icon: <Bus size={18} />, label: 'Trips' },
  { path: '/vehicles', icon: <CarFront size={18} />, label: 'Vehicles' },
  { path: '/drivers', icon: <UserCog size={18} />, label: 'Drivers' },
  
  { label: 'Customer Relations', type: 'section' as const },
  { path: '/passengers', icon: <Users size={18} />, label: 'Passengers' },
  { path: '/crm', icon: <Megaphone size={18} />, label: 'CRM' },
  { path: '/support-tickets', icon: <LifeBuoy size={18} />, label: 'Support Tickets' },
  
  { label: 'Finance & Sales', type: 'section' as const },
  { path: '/bookings', icon: <Ticket size={18} />, label: 'Bookings' },
  { path: '/refunds', icon: <Undo2 size={18} />, label: 'Refund Requests' },
  { path: '/payments', icon: <CreditCard size={18} />, label: 'Payments' },
  { path: '/analytics', icon: <BarChart3 size={18} />, label: 'Analytics' },
  { path: '/finance-calculator', icon: <Calculator size={18} />, label: 'Profit Simulator' },
  
  { label: 'Administration', type: 'section' as const },
  { path: '/administrators', icon: <Shield size={18} />, label: 'Administrators' },
  { path: '/settings', icon: <Settings size={18} />, label: 'Settings' },
  { path: '/partners', icon: <Handshake size={18} />, label: 'Partners' },
];

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/routes': 'Routes',
  '/trips': 'Trips',
  '/vehicles': 'Vehicles',
  '/drivers': 'Drivers',
  '/bookings': 'Bookings',
  '/refunds': 'Refund Requests',
  '/payments': 'Payments',
  '/analytics': 'Analytics & Profits',
  '/finance-calculator': 'Route Profit & Cost Simulator',
  '/passengers': 'Passengers',
  '/crm': 'CRM',
  '/support-tickets': 'Support Tickets',
  '/administrators': 'Administrators',
  '/settings': 'Settings',
  '/partners': 'Partners',
  '/profile': 'My Profile',
};

const pathPermissionMap: Record<string, string> = {
  '/': 'dashboard',
  '/routes': 'routes',
  '/trips': 'trips',
  '/vehicles': 'vehicles',
  '/drivers': 'drivers',
  '/bookings': 'bookings',
  '/refunds': 'bookings',
  '/payments': 'payments',
  '/analytics': 'dashboard',
  '/finance-calculator': 'dashboard',
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

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Auto-collapse sidebar on mobile viewport sizes
  useEffect(() => {
    if (window.innerWidth <= 768) {
      setIsSidebarCollapsed(true);
    }
  }, []);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'New Booking Confirmed', description: 'Passenger Hassan Ali booked Cairo to Alexandria (Seat #3)', time: '2 mins ago', read: false },
    { id: 2, title: 'New Support Chat', description: 'Real-time ticket chat received from Hassan Ali', time: '10 mins ago', read: false },
    { id: 3, title: 'Driver Checked-In', description: 'Youssef Ibrahim checked in passenger Ahmed Mansour', time: '1 hour ago', read: true },
    { id: 4, title: 'Vehicle Status Changed', description: 'Toyota HiAce (ط ر ق ٥٤٣٢) updated to Maintenance', time: '3 hours ago', read: true }
  ]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search Autocomplete States
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [searchData, setSearchData] = useState<{ routes: any[]; drivers: any[]; vehicles: any[]; passengers: any[] }>({
    routes: [],
    drivers: [],
    vehicles: [],
    passengers: []
  });

  // Reset selected index when suggestions list updates
  useEffect(() => {
    setActiveSuggestionIndex(-1);
  }, [suggestions]);

  useEffect(() => {
    const loadSearchData = async () => {
      try {
        const [routes, drivers, vehicles, passengers] = await Promise.all([
          routesAPI.getAll().catch(() => []),
          usersAPI.getByRole('DRIVER').catch(() => []),
          vehiclesAPI.getAll().catch(() => []),
          usersAPI.getByRole('PASSENGER').catch(() => [])
        ]);
        setSearchData({ routes, drivers, vehicles, passengers });
      } catch (err) {
        console.error('Failed to load search autocomplete data', err);
      }
    };
    if (user) {
      loadSearchData();
    }
  }, [user]);

  const getSuggestions = (query: string) => {
    if (!query.trim()) return [];
    const term = query.toLowerCase();
    const results: any[] = [];

    // 1. Match Admin sidebar pages
    const pageMatches = navItems
      .filter(item => !('type' in item) && item.label.toLowerCase().includes(term))
      .map(item => ({
        type: 'page',
        label: (item as any).label,
        path: (item as any).path,
        icon: (item as any).icon
      }));
    if (pageMatches.length > 0) {
      results.push({ category: 'Pages', items: pageMatches });
    }

    // 2. Match Routes
    const routeMatches = searchData.routes
      .filter(r => r.name?.toLowerCase().includes(term))
      .map(r => ({
        type: 'route',
        label: r.name,
        path: '/routes',
        searchTerm: r.name
      }));
    if (routeMatches.length > 0) {
      results.push({ category: 'Routes', items: routeMatches.slice(0, 4) });
    }

    // 3. Match Drivers
    const driverMatches = searchData.drivers
      .filter(d => d.name?.toLowerCase().includes(term) || d.phone?.includes(term))
      .map(d => ({
        type: 'driver',
        label: d.name,
        path: '/drivers',
        searchTerm: d.name
      }));
    if (driverMatches.length > 0) {
      results.push({ category: 'Drivers', items: driverMatches.slice(0, 4) });
    }

    // 4. Match Vehicles
    const vehicleMatches = searchData.vehicles
      .filter(v => v.licensePlate?.toLowerCase().includes(term) || v.model?.toLowerCase().includes(term))
      .map(v => ({
        type: 'vehicle',
        label: `${v.model} (${v.licensePlate || v.plateNumber})`,
        path: '/vehicles',
        searchTerm: v.licensePlate || v.plateNumber
      }));
    if (vehicleMatches.length > 0) {
      results.push({ category: 'Vehicles', items: vehicleMatches.slice(0, 4) });
    }

    // 5. Match Passengers
    const passengerMatches = searchData.passengers
      .filter(p => p.name?.toLowerCase().includes(term) || p.phone?.includes(term))
      .map(p => ({
        type: 'passenger',
        label: p.name,
        path: '/passengers',
        searchTerm: p.name
      }));
    if (passengerMatches.length > 0) {
      results.push({ category: 'Passengers', items: passengerMatches.slice(0, 4) });
    }

    return results;
  };

  const handleSelectSuggestion = (item: any) => {
    setSearchQuery('');
    setSuggestions([]);
    setSearchFocused(false);
    
    if (item.searchTerm) {
      navigate(item.path, { state: { searchTerm: item.searchTerm } });
    } else {
      navigate(item.path);
    }
  };

  const flattenedSuggestions = suggestions.flatMap(cat => cat.items);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => 
        prev < flattenedSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => 
        prev > 0 ? prev - 1 : flattenedSuggestions.length - 1
      );
    } else if (e.key === 'Enter') {
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < flattenedSuggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(flattenedSuggestions[activeSuggestionIndex]);
      }
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setSearchFocused(false);
    }
  };

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
    <div className={`dashboard-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Mobile Sidebar Backdrop */}
      {!isSidebarCollapsed && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setIsSidebarCollapsed(true)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────── */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <NavLink 
          to="/" 
          className="sidebar-header" 
          style={{ display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', gap: '0.75rem', textDecoration: 'none' }}
          onClick={() => {
            if (window.innerWidth <= 768) {
              setIsSidebarCollapsed(true);
            }
          }}
        >
          {isSidebarCollapsed ? (
            <div className="sidebar-logo-collapsed" title="D-Ride Admin Center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={favicon} alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src={logo} alt="Logo" style={{ height: '38px', width: 'auto', borderRadius: '6px', objectFit: 'contain', boxShadow: '0 0 15px rgba(245, 183, 49, 0.4)', flexShrink: 0 }} />
            </div>
          )}
        </NavLink>

        <nav className="sidebar-nav">
          {finalNavItems.map((item, i) =>
            'type' in item && item.type === 'section' ? (
              <div key={i} className="sidebar-section-label">{item.label}</div>
            ) : (
              <NavLink
                key={item.path}
                to={item.path!}
                end={item.path === '/'}
                title={isSidebarCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `sidebar-item${isActive ? ' active' : ''}`
                }
                onClick={() => {
                  if (window.innerWidth <= 768) {
                    setIsSidebarCollapsed(true);
                  }
                }}
              >
                <span className="sidebar-item-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ),
          )}
        </nav>

        <div className="sidebar-footer" style={{ textAlign: isSidebarCollapsed ? 'center' : 'left' }}>
          {isSidebarCollapsed ? (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, cursor: 'help' }} title="Operated by Destination">
              © D
            </span>
          ) : (
            <span className="sidebar-footer-text">Operated by Destination</span>
          )}
        </div>
      </aside>

      {/* ── Main Content ───────────────────────────────── */}
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button 
              className="topbar-icon-btn sidebar-toggle-btn"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              style={{ marginRight: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <Menu size={18} />
            </button>
            <h2 className="topbar-title">{currentTitle}</h2>
          </div>
          <div className="topbar-search" style={{ position: 'relative' }}>
            <span><Search size={16} /></span>
            <input 
              type="text" 
              placeholder="Search pages, routes, drivers, vehicles..." 
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                setSuggestions(getSuggestions(val));
              }}
              onFocus={() => {
                setSearchFocused(true);
                setSuggestions(getSuggestions(searchQuery));
              }}
              onBlur={() => {
                // Delay blur to allow clicks on dropdown items
                setTimeout(() => setSearchFocused(false), 200);
              }}
              onKeyDown={handleKeyDown}
            />
            
            {searchFocused && suggestions.length > 0 && (
              <div 
                className="search-suggestions-dropdown" 
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  right: 0,
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 2000,
                  maxHeight: '320px',
                  overflowY: 'auto',
                  padding: '8px 0'
                }}
              >
                {(() => {
                  let globalItemIdx = -1;
                  return suggestions.map((cat, catIdx) => (
                    <div key={catIdx} className="suggestion-category-group">
                      <div style={{
                        padding: '4px 12px',
                        fontSize: '10px',
                        fontWeight: 800,
                        color: 'var(--primary-color)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                        marginBottom: '4px'
                      }}>
                        {cat.category}
                      </div>
                      {cat.items.map((item: any, itemIdx: number) => {
                        globalItemIdx++;
                        const currentGlobalIdx = globalItemIdx;
                        const isActive = currentGlobalIdx === activeSuggestionIndex;
                        return (
                          <div
                            key={itemIdx}
                            onClick={() => handleSelectSuggestion(item)}
                            style={{
                              padding: '8px 16px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              color: 'var(--text-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              textAlign: 'left',
                              backgroundColor: isActive ? 'var(--surface-hover)' : 'transparent'
                            }}
                            onMouseEnter={() => setActiveSuggestionIndex(currentGlobalIdx)}
                          >
                            {item.icon ? (
                              <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>{item.icon}</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>🔍</span>
                            )}
                            <span>{item.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
            )}
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
                    <NavLink 
                      to="/profile" 
                      onClick={() => setIsDropdownOpen(false)}
                      className="profile-menu-item"
                      style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        textDecoration: 'none'
                      }}
                    >
                      <User size={16} style={{ color: 'var(--text-secondary)' }} /> My Profile
                    </NavLink>
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

      {/* Administrator profile modal removed in favor of standalone /profile page */}
    </div>
  );
}
