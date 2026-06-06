import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useTranslation } from './context/LanguageContext';
import { NotificationProvider } from './context/NotificationContext';
import LoginPage from './pages/Login';
// Keep unused pages for backup/reference:
// import MyTripsPage from './pages/MyTrips';
// import TripDetailPage from './pages/TripDetail';
// import LiveDrivePage from './pages/LiveDrive';
import DashboardPage from './pages/Dashboard';
import BottomNav from './components/BottomNav';
import ProfilePage from './pages/ProfilePage';


// Protected Route Guard
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading, user, logout } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 24px', alignItems: 'center', background: '#0d0d0d', color: '#fff', height: '100vh' }}>
        <span>{t('authenticatingSession') || '⏳ Authenticating...'}</span>
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.role?.toUpperCase() !== 'DRIVER') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0d0d0d',
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🚫</div>
        <h1 style={{ fontSize: '1.8rem', color: '#f5b731', margin: '0 0 10px 0' }}>Access Denied</h1>
        <p style={{ color: '#a3a3a3', maxWidth: '400px', margin: '0 0 20px 0' }}>
          This portal is restricted to driver partners only.
        </p>
        <button onClick={logout} style={{
          background: '#f5b731',
          color: '#000',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: 'bold'
        }}>
          Sign Out
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

function AnonymousRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  if (token && user && user.role?.toUpperCase() === 'DRIVER') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <NotificationProvider>
          <Router>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<AnonymousRoute><LoginPage /></AnonymousRoute>} />

              {/* Protected routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/trips"
                element={
                  <Navigate to="/dashboard" replace />
                }
              />
              <Route
                path="/trips/:id"
                element={
                  <Navigate to="/dashboard" replace />
                }
              />
              <Route
                path="/drive/:id"
                element={
                  <Navigate to="/dashboard" replace />
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            
            {/* Bottom tab navigation */}
            <BottomNav />
          </Router>
        </NotificationProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
