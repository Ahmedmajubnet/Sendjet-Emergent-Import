import React, { useState } from 'react';
import { useAuth } from '../App';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plane, Package, Shield, Mail, Lock, User } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import GoogleSignInButton from './GoogleSignInButton';

const AuthPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  // Progressive engagement: honour ?next=<intent-url>&action=<intent-name>
  const params = new URLSearchParams(location.search);
  const nextRaw = params.get('next');
  // Only allow same-site relative paths for the redirect (prevents open-redirect).
  const nextPath = nextRaw && nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/dashboard';
  const intentAction = params.get('action');
  const initialTab = params.get('tab') === 'signup' ? 'register' : 'login';
  const returnUrl = intentAction ? `${nextPath}${nextPath.includes('?') ? '&' : '?'}action=${encodeURIComponent(intentAction)}` : nextPath;

  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    full_name: '',
    terms_accepted: false
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post('/auth/login', loginData);
      login(response.data.access_token, response.data.user);
      // PostHog: identify + funnel event
      if (typeof window !== 'undefined' && window.posthog) {
        try {
          window.posthog.identify(response.data.user.id, {
            role: response.data.user.role,
          });
          window.posthog.capture('login_completed');
        } catch (_) { /* analytics must never break auth */ void 0; }
      }
      toast.success('Welcome back to SendJet!');
      navigate(returnUrl, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (typeof window !== 'undefined' && window.posthog) {
      try { window.posthog.capture('signup_started'); } catch (_) { void 0; }
    }

    try {
      const response = await axios.post('/auth/register', registerData);
      login(response.data.access_token, response.data.user);
      if (typeof window !== 'undefined' && window.posthog) {
        try {
          window.posthog.identify(response.data.user.id, {
            role: response.data.user.role,
          });
          window.posthog.capture('signup_completed');
        } catch (_) { void 0; }
      }
      toast.success('Welcome to SendJet! Your account is ready.');
      navigate(returnUrl, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 px-3 py-4 sm:p-6 overflow-x-hidden">
      <div className="w-full max-w-4xl grid lg:grid-cols-2 gap-5 sm:gap-8 items-center">

        {/* Hero Section */}
        <div className="hidden lg:flex flex-col items-center text-center space-y-6 fade-in">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-300 to-amber-300 rounded-full blur-3xl opacity-30 animate-pulse"></div>
            <img
              src="/sendjet-logo.png?v=4"
              alt="SendJet — Send Smart, Travel Light"
              className="relative w-96 h-auto select-none"
              draggable="false"
            />
          </div>

          <div className="space-y-3 max-w-md">
            <p className="text-xl text-gray-600 font-medium">
              Connecting Travelers & Senders
            </p>
            <p className="text-gray-500">
              A simple marketplace connecting senders with people already traveling by plane, car, train or bus. Start with a basic account and build trust as you use SendJet.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center w-full max-w-md">
            <div className="bg-white rounded-2xl p-4 shadow-soft">
              <Shield className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Secure</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-soft">
              <Plane className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Fast</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-soft">
              <Package className="h-8 w-8 text-purple-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Reliable</p>
            </div>
          </div>
        </div>

        {/* Auth Forms */}
        <div className="w-full max-w-md mx-auto slide-in min-w-0">
          <Card className="shadow-strong border-0 bg-white/95 backdrop-blur-sm overflow-hidden">
            <CardHeader className="text-center pb-2 pt-4 sm:pt-6 px-4 sm:px-6">
              {/* Mobile-only: use the FULL vertical lockup (logo already includes "SendJet" + tagline) */}
              <img
                src="/sendjet-logo.png?v=5"
                alt="SendJet — Send Smart, Travel Light"
                className="lg:hidden w-36 sm:w-48 h-auto mx-auto select-none"
                draggable="false"
              />
              {/* Desktop / large screens already see the big hero logo on the left, so just show a small heading inside the card */}
              <CardTitle className="hidden lg:block text-2xl font-bold text-gray-800">Welcome to SendJet</CardTitle>
              <CardDescription className="hidden lg:block text-gray-600">
                Join the future of parcel delivery
              </CardDescription>
            </CardHeader>

            <CardContent className="px-4 sm:px-6 pb-5 sm:pb-6">
              <GoogleSignInButton nextPath={nextPath} intentAction={intentAction} />

              <div className="relative my-5 sm:my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200"></span>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500 tracking-wider">or continue with email</span>
                </div>
              </div>

              <Tabs defaultValue={initialTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-5 sm:mb-6">
                  <TabsTrigger value="login" className="font-medium" data-testid="auth-tab-login">Sign In</TabsTrigger>
                  <TabsTrigger value="register" className="font-medium" data-testid="auth-tab-register">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="your@email.com"
                        value={loginData.email}
                        onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                        required
                        className="input-focus"
                        data-testid="login-email-input"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password" className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Password
                      </Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="Enter your password"
                        value={loginData.password}
                        onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                        required
                        className="input-focus"
                        data-testid="login-password-input"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full btn-primary text-white font-medium py-2.5"
                      disabled={loading}
                      data-testid="login-submit-button"
                    >
                      {loading ? 'Signing In...' : 'Sign In'}
                    </Button>

                    <div className="text-center pt-1">
                      <a
                        href="/forgot-password"
                        className="text-sm text-gray-600 hover:text-orange-600 hover:underline"
                        data-testid="forgot-password-link"
                      >
                        Forgot your password?
                      </a>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-name" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Full Name
                      </Label>
                      <Input
                        id="register-name"
                        type="text"
                        placeholder="John Doe"
                        value={registerData.full_name}
                        onChange={(e) => setRegisterData({...registerData, full_name: e.target.value})}
                        required
                        className="input-focus"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-email" className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </Label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="your@email.com"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                        required
                        className="input-focus"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="register-password" className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Password
                      </Label>
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="Create a strong password"
                        value={registerData.password}
                        onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                        required
                        className="input-focus"
                      />
                    </div>


                    <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={registerData.terms_accepted}
                        onChange={(e) => setRegisterData({...registerData, terms_accepted: e.target.checked})}
                        required
                        className="mt-1"
                      />
                      <span>I agree to the <a href="/legal#terms" className="text-orange-600 hover:underline">Terms of Use</a> and <a href="/legal#privacy" className="text-orange-600 hover:underline">Privacy Policy</a>.</span>
                    </label>

                    <Button
                      type="submit"
                      className="w-full btn-primary text-white font-medium py-2.5"
                      disabled={loading}
                    >
                      {loading ? 'Creating Account...' : 'Create Account'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="text-center mt-4 sm:mt-6 px-3">
            <p className="text-sm text-gray-500">
              Your account starts simple — add more profile details whenever you’re ready.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;