import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useTranslation } from './context/LanguageContext';
import LoginPage from './pages/Login';
import MyTripsPage from './pages/MyTrips';
import TripDetailPage from './pages/TripDetail';
import LiveDrivePage from './pages/LiveDrive';
import BottomNav from './components/BottomNav';

// Protected Route Guard
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 24px' }}>
        <span>{t('authenticatingSession')}</span>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected routes */}
            <Route
              path="/trips"
              element={
                <ProtectedRoute>
                  <MyTripsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trips/:id"
              element={
                <ProtectedRoute>
                  <TripDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/drive/:id"
              element={
                <ProtectedRoute>
                  <LiveDrivePage />
                </ProtectedRoute>
              }
            />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/trips" replace />} />
          </Routes>
          
          {/* Bottom tab navigation */}
          <BottomNav />
        </Router>
      </LanguageProvider>
    </AuthProvider>
  );
}
