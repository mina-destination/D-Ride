import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import Navbar from './components/Navbar';
import HomePage from './pages/Home';
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import MyTripsPage from './pages/MyTrips';
import TripSearchPage from './pages/TripSearch';
import CheckoutPage from './pages/Checkout';
import LiveTrackingPage from './pages/LiveTracking';
import PaymentCallbackPage from './pages/PaymentCallback';
import ContactPage from './pages/ContactPage';
import RoutesPage from './pages/RoutesPage';
import './App.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
        <span className="app-loading-text">Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/routes" element={<RoutesPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
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
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;
