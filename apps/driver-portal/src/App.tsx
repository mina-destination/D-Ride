import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useTranslation } from './context/LanguageContext';
import { NotificationProvider } from './context/NotificationContext';
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import LoginPage from './pages/Login';
import MyTripsPage from './pages/MyTrips';
import TripDetailPage from './pages/TripDetail';
import LiveDrivePage from './pages/LiveDrive';
import DashboardPage from './pages/Dashboard';
import BottomNav from './components/BottomNav';
import ProfilePage from './pages/ProfilePage';
import HelpPage from './pages/Help';
import BackgroundReadinessGuard from './components/BackgroundReadinessGuard';


// Protected Route Guard
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading, user, logout } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 24px', alignItems: 'center', background: '#0d0d0d', color: '#fff', height: '100vh' }}>
        <span>{t('authenticatingSession') || 'Authenticating...'}</span>
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
        <svg style={{ color: '#ef4444', marginBottom: '16px' }} className="animate-pulse" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <h1 style={{ fontSize: '1.8rem', color: '#f5b731', margin: '0 0 10px 0' }}>Access Denied</h1>
        <p style={{ color: '#a3a3a3', maxWidth: '400px', margin: '0 0 20px 0' }}>
          This portal is restricted to driver partners only.
        </p>
        <button onClick={logout} className="cursor-pointer transition-all duration-200 hover:brightness-95" style={{
          background: '#f5b731',
          color: '#000',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '6px',
          fontSize: '0.9rem',
          fontWeight: 'bold'
        }}>
          Sign Out
        </button>
      </div>
    );
  }

  return <BackgroundReadinessGuard>{children}</BackgroundReadinessGuard>;
}

function AnonymousRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  if (token && user && user.role?.toUpperCase() === 'DRIVER') {
    return <Navigate to="/trips" replace />;
  }
  return <>{children}</>;
}

import { ThemeProvider } from './context/ThemeContext';

export default function App() {
  useEffect(() => {
    const requestNativePermissions = async () => {
      if (!Capacitor.isNativePlatform()) return;

      try {
        // Request Geolocation permissions
        const geoPerm = await Geolocation.checkPermissions();
        if (geoPerm.location !== 'granted') {
          await Geolocation.requestPermissions();
        }
      } catch (err) {
        console.warn('Failed to check/request location permission:', err);
      }

      try {
        // Request Camera permission by triggering a brief dummy stream request
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach((track) => track.stop());
        }
      } catch (err) {
        console.warn('Failed to check/request camera permission:', err);
      }
    };

    requestNativePermissions();
  }, []);

  // App resume detection — restart background location if the OS killed it
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;

      try {
        const { BackgroundLocation } = await import('./capacitor-plugins/background-location');
        const status = await BackgroundLocation.isRunning();
        
        console.log('[App] Resumed from background. Service running:', status.running);
        if (!status.running) {
          await BackgroundLocation.restart();
          console.log('[App] Initiated background location restart recovery.');
        }
      } catch (err) {
        console.warn('[App] Failed to check background location on resume:', err);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);


  return (
    <AuthProvider>
      <LanguageProvider>
        <ThemeProvider>
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
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/help"
                element={
                  <ProtectedRoute>
                    <HelpPage />
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
        </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
