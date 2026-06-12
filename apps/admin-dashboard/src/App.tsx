import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme as antdTheme, App as AntdApp } from 'antd';
import { antThemeConfig, antThemeConfigDark } from '@transport/shared-theme';
import { useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { setGlobalAntd } from './utils/antdGlobal';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';


import { VehiclesPage } from './pages/VehiclesPage';
import { DriversPage } from './pages/DriversPage';
import { PassengersPage } from './pages/PassengersPage';
import { BookingsPage } from './pages/BookingsPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { RoutesPage } from './pages/RoutesPage';
import { TripsPage } from './pages/TripsPage';
import { CrmPage } from './pages/CrmPage';
import { SupportTicketsPage } from './pages/SupportTicketsPage';
import { AdministratorsPage } from './pages/AdministratorsPage';
import { PartnersPage } from './pages/PartnersPage';
import { PromoCodesPage } from './pages/PromoCodesPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ProfilePage } from './pages/ProfilePage';
import { RefundsPage } from './pages/RefundsPage';
import { TripDetailsPage } from './pages/TripDetailsPage';
import { RouteFinancePage } from './pages/RouteFinancePage';
import { TripHistoryPage } from './pages/TripHistoryPage';
import { LiveTrackingPage } from './pages/LiveTrackingPage';
import { ConfirmProvider } from './context/ConfirmContext';
import './App.css';

import { Result, Button, Space } from 'antd';

function AntdGlobalHelper() {
  const { message, notification, modal } = AntdApp.useApp();
  setGlobalAntd({ message, notification, modal });
  return null;
}

function ProtectedRoute({ children, permission }: { children: React.ReactNode; permission?: string }) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--background)',
        color: 'var(--primary)',
        fontSize: '1.2rem',
        fontWeight: 600,
      }}>
        ⏳ Verifying Authorization...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const currentUser = user;

  if (currentUser) {
    const adminRoles = ['OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION'];
    if (!adminRoles.includes(currentUser.role?.toUpperCase())) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--background)',
          padding: '2rem'
        }}>
          <Result
            status="403"
            title="Access Denied"
            subTitle="Your account does not have access to the administration dashboard."
            extra={
              <Space size="middle">
                <Button href="http://localhost:5173" type="primary" style={{ background: 'var(--primary-color)' }}>
                  Go to Passenger Portal
                </Button>
                <Button danger onClick={logout} type="dashed">
                  Sign Out
                </Button>
              </Space>
            }
          />
        </div>
      );
    }
  }

  if (permission && currentUser) {
    if (currentUser.role === 'OWNER') {
      return <>{children}</>;
    }
    const hasPermission = currentUser.permissions?.includes(permission);
    if (!hasPermission) {
      return (
        <div className="glass" style={{
          margin: '2rem',
          padding: '3rem',
          background: 'var(--surface-elevated)',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <Result
            status="403"
            title="Access Denied"
            subTitle="You do not have the required permissions to view this resource."
            extra={
              <Space size="middle">
                <Button type="primary" href="/" style={{ background: 'var(--primary-color)' }}>
                  Return to Dashboard
                </Button>
                <Button href="http://localhost:5173" style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  Go to Passenger Portal
                </Button>
                <Button danger onClick={logout} type="dashed">
                  Sign Out
                </Button>
              </Space>
            }
          />
        </div>
      );
    }
  }

  return <>{children}</>;
}

function AnonymousRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function DashboardIndexRoute() {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'OWNER' || user.permissions?.includes('dashboard')) {
    return <DashboardPage />;
  }
  
  // Find first permitted page
  const allowedPermission = [
    'routes',
    'trips',
    'live-tracking',
    'vehicles',
    'drivers',
    'bookings',
    'refunds',
    'payments',
    'transactions',
    'analytics',
    'finance-calculator',
    'passengers',
    'crm',
    'reviews',
    'support-tickets',
    'settings',
    'notifications',
    'partners',
    'promo-codes'
  ].find(p => user.permissions?.includes(p));
  
  if (allowedPermission) {
    const pathMap: Record<string, string> = {
      routes: '/routes',
      trips: '/trips',
      'live-tracking': '/live-tracking',
      vehicles: '/vehicles',
      drivers: '/drivers',
      bookings: '/bookings',
      refunds: '/refunds',
      payments: '/payments',
      transactions: '/transactions',
      analytics: '/analytics',
      'finance-calculator': '/finance-calculator',
      passengers: '/passengers',
      crm: '/crm',
      reviews: '/reviews',
      'support-tickets': '/support-tickets',
      settings: '/settings',
      notifications: '/notifications',
      partners: '/partners',
      'promo-codes': '/promo-codes'
    };
    return <Navigate to={pathMap[allowedPermission]} replace />;
  }

  return (
    <ProtectedRoute permission="dashboard">
      <DashboardPage />
    </ProtectedRoute>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AnonymousRoute><LoginPage /></AnonymousRoute>} />

      {/* Protected dashboard routes */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardIndexRoute />} />
        <Route path="routes" element={<ProtectedRoute permission="routes"><RoutesPage /></ProtectedRoute>} />
        <Route path="trips" element={<ProtectedRoute permission="trips"><TripsPage /></ProtectedRoute>} />
        <Route path="trips/:id" element={<ProtectedRoute permission="trips"><TripDetailsPage /></ProtectedRoute>} />
        <Route path="trip-history" element={<ProtectedRoute permission="trips"><TripHistoryPage /></ProtectedRoute>} />
        <Route path="live-tracking" element={<ProtectedRoute permission="vehicles"><LiveTrackingPage /></ProtectedRoute>} />
        <Route path="vehicles" element={<ProtectedRoute permission="vehicles"><VehiclesPage /></ProtectedRoute>} />
        <Route path="drivers" element={<ProtectedRoute permission="drivers"><DriversPage /></ProtectedRoute>} />
        <Route path="bookings" element={<ProtectedRoute permission="bookings"><BookingsPage /></ProtectedRoute>} />
        <Route path="refunds" element={<ProtectedRoute permission="refunds"><RefundsPage /></ProtectedRoute>} />
        <Route path="payments" element={<ProtectedRoute permission="payments"><PaymentsPage /></ProtectedRoute>} />
        <Route path="transactions" element={<ProtectedRoute permission="payments"><TransactionsPage /></ProtectedRoute>} />
        <Route path="reviews" element={<ProtectedRoute permission="crm"><ReviewsPage /></ProtectedRoute>} />
        <Route path="notifications" element={<ProtectedRoute permission="settings"><NotificationsPage /></ProtectedRoute>} />
        <Route path="analytics" element={<ProtectedRoute permission="analytics"><AnalyticsPage /></ProtectedRoute>} />
        <Route path="finance-calculator" element={<ProtectedRoute permission="finance-calculator"><RouteFinancePage /></ProtectedRoute>} />
        <Route path="passengers" element={<ProtectedRoute permission="passengers"><PassengersPage /></ProtectedRoute>} />
        <Route path="crm" element={<ProtectedRoute permission="crm"><CrmPage /></ProtectedRoute>} />
        <Route path="support-tickets" element={<ProtectedRoute permission="support-tickets"><SupportTicketsPage /></ProtectedRoute>} />
        <Route path="administrators" element={<ProtectedRoute permission="settings"><AdministratorsPage /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute permission="settings"><SettingsPage /></ProtectedRoute>} />
        <Route path="partners" element={<ProtectedRoute permission="partners"><PartnersPage /></ProtectedRoute>} />
        <Route path="promo-codes" element={<ProtectedRoute permission="promo-codes"><PromoCodesPage /></ProtectedRoute>} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  const { theme } = useTheme();
  
  const currentTheme = theme === 'dark' 
    ? { ...antThemeConfigDark, algorithm: antdTheme.darkAlgorithm } 
    : antThemeConfig;

  return (
    <ConfigProvider theme={currentTheme}>
      <AntdApp>
        <AntdGlobalHelper />
        <BrowserRouter>
          <AuthProvider>
            <ConfirmProvider>
              <AppRoutes />
            </ConfirmProvider>
          </AuthProvider>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
