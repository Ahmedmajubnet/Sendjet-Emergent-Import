import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import axios from 'axios';
import './App.css';

// Import components
import AuthPage from './components/AuthPage';
import AuthCallback from './components/AuthCallback';
import LandingPage from './components/LandingPage';
import VerifyEmailPage from './components/VerifyEmailPage';
import ForgotPasswordPage from './components/ForgotPasswordPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import ImprovedDashboard from './components/ImprovedDashboard';
import TripForm from './components/TripForm';
import ShipmentForm from './components/ShipmentForm';
import MarketPlace from './components/MarketPlace';
import MessagingHub from './components/MessagingHub';
import DirectMessagesList from './components/DirectMessagesList';
import DirectMessaging from './components/DirectMessaging';
import NotificationsPage from './components/NotificationsPage';
import MatchRequests from './components/MatchRequests';
import BookingPayment from './components/BookingPayment';
import UserProfile from './components/UserProfile';
import ShipmentDetails from './components/ShipmentDetails';
import GoogleMapsIntegration from './components/GoogleMapsIntegration';
import PaymentSuccess from './components/PaymentSuccess';
import PaymentCancelled from './components/PaymentCancelled';
import AdminDashboard from './components/AdminDashboard';
import LegalPage from './components/LegalPage';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import InstallPrompt from './components/InstallPrompt';
import AboutPage from './components/AboutPage';
import FAQPage from './components/FAQPage';
import SafetyPage from './components/SafetyPage';
import ContactPage from './components/ContactPage';
import ImpressumPage from './components/ImpressumPage';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Set up axios defaults
axios.defaults.baseURL = API;

// Axios response interceptor for expired tokens
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear auth and redirect
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      const publicPaths = ['/auth', '/marketplace', '/legal', '/'];
      if (!publicPaths.includes(window.location.pathname)) {
        window.location.href = '/auth';
      }
    }
    return Promise.reject(error);
  }
);

// Auth context
const AuthContext = React.createContext();

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Skip refetch if user is already populated (e.g., right after login/register).
      // This prevents a race where a redundant /auth/me call could fail and force logout
      // mid-redirect, causing a flaky login experience.
      if (!user) {
        fetchUser();
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    setToken(token);
    setUser(userData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  const refreshUser = async () => {
    if (!localStorage.getItem('token')) return null;
    const response = await axios.get('/auth/me');
    setUser(response.data);
    return response.data;
  };

  const value = {
    user,
    login,
    logout,
    refreshUser,
    loading,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/auth" replace />;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // If already authenticated, honour ?next=... so the auth intent flow works cleanly.
  if (isAuthenticated) {
    const params = new URLSearchParams(location.search);
    const next = params.get('next');
    return <Navigate to={next && next.startsWith('/') ? next : '/dashboard'} replace />;
  }
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-cream">
          <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:border focus:border-hairline focus:rounded-full focus:px-4 focus:py-2 focus:text-ink font-medium">
            Skip to main content
          </a>
          <Routes>
            {/* Public routes */}
            <Route
              path="/auth"
              element={
                <PublicRoute>
                  <AuthPage />
                </PublicRoute>
              }
            />
            {/* Google OAuth callback — public, no PublicRoute wrapper so the
                session_id hash is processed even if a stale JWT is present. */}
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/legal" element={<LegalPage />} />

            {/* Public info / legal pages */}
            <Route path="/about"     element={<AboutPage />} />
            <Route path="/faq"       element={<FAQPage />} />
            <Route path="/safety"    element={<SafetyPage />} />
            <Route path="/contact"   element={<ContactPage />} />
            <Route path="/impressum" element={<ImpressumPage />} />

            {/* Public marketplace - viewable without login */}
            <Route
              path="/marketplace"
              element={
                <>
                  <Navbar />
                  <MarketPlace />
                </>
              }
            />

            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Navbar />
                  <ImprovedDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create-trip"
              element={
                <ProtectedRoute>
                  <Navbar />
                  <TripForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create-shipment"
              element={
                <ProtectedRoute>
                  <Navbar />
                  <ShipmentForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <Navbar />
                  <MessagingHub />
                </ProtectedRoute>
              }
            />
            <Route
              path="/direct-messages"
              element={
                <ProtectedRoute>
                  <Navbar />
                  <DirectMessagesList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Navbar />
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/direct-messages/:conversationId"
              element={
                <ProtectedRoute>
                  <DirectMessaging />
                </ProtectedRoute>
              }
            />
            <Route
              path="/match-requests"
              element={
                <ProtectedRoute>
                  <Navbar />
                  <MatchRequests />
                </ProtectedRoute>
              }
            />
            <Route
              path="/booking/:matchId/payment"
              element={
                <ProtectedRoute>
                  <Navbar />
                  <BookingPayment />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/:userId"
              element={
                <ProtectedRoute>
                  <Navbar />
                  <UserProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shipment/:shipmentId"
              element={
                <ProtectedRoute>
                  <Navbar />
                  <ShipmentDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payment-success"
              element={
                <ProtectedRoute>
                  <Navbar />
                  <PaymentSuccess />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payment-cancelled"
              element={
                <ProtectedRoute>
                  <Navbar />
                  <PaymentCancelled />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <Navbar />
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tracking/:tripId"
              element={
                <ProtectedRoute>
                  <Navbar />
                  <GoogleMapsIntegration />
                </ProtectedRoute>
              }
            />

            {/* Landing (anonymous, progressive engagement) */}
            <Route path="/" element={<LandingPage />} />

            {/* Public email-flow pages */}
            <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          </Routes>

          <SiteFooter />

          <Toaster position="top-right" />
          <InstallPrompt />
        </div>
      </Router>
    </AuthProvider>
  );
}

/**
 * Wrap Footer so it can read the current pathname.
 * Hides itself on /auth (auth page is its own self-contained screen).
 */
function SiteFooter() {
  const location = useLocation();
  if (location.pathname.startsWith('/auth') || /^\/direct-messages\/[^/]+$/.test(location.pathname)) return null;
  return <Footer />;
}

export default App;