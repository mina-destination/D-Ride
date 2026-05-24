import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { antThemeConfig, antThemeConfigDark } from '@transport/shared-theme';
import { useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';

import { VehiclesPage } from './pages/VehiclesPage';
import { DriversPage } from './pages/DriversPage';
import { PassengersPage } from './pages/PassengersPage';
import { BookingsPage } from './pages/BookingsPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { SettingsPage } from './pages/SettingsPage';
import { RoutesPage } from './pages/RoutesPage';
import { TripsPage } from './pages/TripsPage';
import { CrmPage } from './pages/CrmPage';
import { SupportTicketsPage } from './pages/SupportTicketsPage';
import { AdministratorsPage } from './pages/AdministratorsPage';
import { PartnersPage } from './pages/PartnersPage';
import './App.css';

import { Result, Button, Space } from 'antd';

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
        ⏳ Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user) {
    const adminRoles = ['OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION'];
    if (!adminRoles.includes(user.role?.toUpperCase())) {
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

  if (permission && user) {
    if (user.role === 'OWNER') {
      return <>{children}</>;
    }
    const hasPermission = user.permissions?.includes(permission);
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

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Protected dashboard routes */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ProtectedRoute permission="dashboard"><DashboardPage /></ProtectedRoute>} />
        <Route path="routes" element={<ProtectedRoute permission="routes"><RoutesPage /></ProtectedRoute>} />
        <Route path="trips" element={<ProtectedRoute permission="trips"><TripsPage /></ProtectedRoute>} />
        <Route path="vehicles" element={<ProtectedRoute permission="vehicles"><VehiclesPage /></ProtectedRoute>} />
        <Route path="drivers" element={<ProtectedRoute permission="drivers"><DriversPage /></ProtectedRoute>} />
        <Route path="bookings" element={<ProtectedRoute permission="bookings"><BookingsPage /></ProtectedRoute>} />
        <Route path="payments" element={<ProtectedRoute permission="payments"><PaymentsPage /></ProtectedRoute>} />
        <Route path="passengers" element={<ProtectedRoute permission="passengers"><PassengersPage /></ProtectedRoute>} />
        <Route path="crm" element={<ProtectedRoute permission="crm"><CrmPage /></ProtectedRoute>} />
        <Route path="support-tickets" element={<ProtectedRoute permission="crm"><SupportTicketsPage /></ProtectedRoute>} />
        <Route path="administrators" element={<ProtectedRoute permission="settings"><AdministratorsPage /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute permission="settings"><SettingsPage /></ProtectedRoute>} />
        <Route path="partners" element={<ProtectedRoute permission="settings"><PartnersPage /></ProtectedRoute>} />
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
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
