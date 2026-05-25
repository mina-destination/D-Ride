import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import SupportChatWidget from './components/SupportChatWidget';
import HomePage from './pages/Home';
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import MyTripsPage from './pages/MyTrips';
import TripSearchPage from './pages/TripSearch';
import CheckoutPage from './pages/Checkout';
import PaymentPage from './pages/Payment';
import LiveTrackingPage from './pages/LiveTracking';
import PaymentCallbackPage from './pages/PaymentCallback';
import ContactPage from './pages/ContactPage';
import RoutesPage from './pages/RoutesPage';
import PartnersPage from './pages/PartnersPage';
import './App.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
        <span className="app-loading-text">Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const adminRoles = ['OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION'];
  if (adminRoles.includes(user.role?.toUpperCase())) {
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
          Administrators are not permitted to use the passenger application portal.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <a href="http://localhost:5174" style={{
            background: '#f5b731',
            color: '#000',
            padding: '10px 20px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: 'bold',
            fontSize: '0.9rem'
          }}>
            Go to Admin Dashboard
          </a>
          <button onClick={logout} style={{
            background: 'transparent',
            color: '#fff',
            border: '1px solid #333',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 'bold'
          }}>
            Sign Out
          </button>
        </div>
      </div>
    );
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

function AppRoutes() {
  return (
    <>
      <Navbar />
      <SupportChatWidget />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/routes" element={<RoutesPage />} />
        <Route path="/partners" element={<PartnersPage />} />
        <Route path="/login" element={<AnonymousRoute><LoginPage /></AnonymousRoute>} />
        <Route path="/register" element={<AnonymousRoute><RegisterPage /></AnonymousRoute>} />
        <Route path="/search" element={<TripSearchPage />} />
        <Route
          path="/contact"
          element={
            <ProtectedRoute>
              <ContactPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-trips"
          element={
            <ProtectedRoute>
              <MyTripsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment"
          element={
            <ProtectedRoute>
              <PaymentPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/track"
          element={
            <ProtectedRoute>
              <LiveTrackingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment/callback"
          element={
            <ProtectedRoute>
              <PaymentCallbackPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;
