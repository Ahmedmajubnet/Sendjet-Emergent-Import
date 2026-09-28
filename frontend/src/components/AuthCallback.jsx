import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

/**
 * Handles the managed Google OAuth callback.
 * Providers can return session_id in either the URL hash or the query string,
 * so both formats are supported here.
 */
const AuthCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hashParams = new URLSearchParams((location.hash || '').replace(/^#/, ''));
    const searchParams = new URLSearchParams(location.search || '');
    const sessionId = hashParams.get('session_id') || searchParams.get('session_id');
    const providerError = hashParams.get('error') || searchParams.get('error');
    const providerErrorDescription = hashParams.get('error_description') || searchParams.get('error_description');

    let next = '/dashboard';
    let termsVersion = null;
    try {
      const saved = sessionStorage.getItem('sendjet_auth_next');
      if (saved && saved.startsWith('/') && !saved.startsWith('//')) next = saved;
      termsVersion = sessionStorage.getItem('sendjet_google_terms_version');
    } catch (_) {
      void 0;
    }

    const clearTransientState = () => {
      try {
        sessionStorage.removeItem('sendjet_auth_next');
        sessionStorage.removeItem('sendjet_google_terms_version');
      } catch (_) { void 0; }
    };

    if (providerError) {
      clearTransientState();
      console.error('Google OAuth provider error:', providerError, providerErrorDescription || '');
      toast.error(providerErrorDescription || 'Google sign-in was cancelled or could not be completed.');
      navigate('/auth', { replace: true });
      return;
    }

    if (!sessionId) {
      clearTransientState();
      toast.error('Google sign-in did not return a valid session. Please try again.');
      navigate('/auth', { replace: true });
      return;
    }

    (async () => {
      try {
        const headers = { 'X-Session-ID': sessionId };
        if (termsVersion) headers['X-Terms-Version'] = termsVersion;

        const response = await axios.post('/auth/google/session', null, { headers });
        login(response.data.access_token, response.data.user);

        if (typeof window !== 'undefined' && window.posthog) {
          try {
            window.posthog.identify(response.data.user.id, { role: response.data.user.role });
            window.posthog.capture('google_signin_completed');
          } catch (_) { void 0; }
        }

        clearTransientState();
        const firstName = (response.data.user.full_name || 'there').split(' ')[0];
        toast.success(`Welcome, ${firstName}!`);

        // Remove session_id/error fragments from browser history before navigating.
        window.history.replaceState({}, document.title, '/auth/callback');
        navigate(next, { replace: true });
      } catch (error) {
        clearTransientState();
        console.error('Google session exchange failed:', error);
        const detail = error.response?.data?.detail;
        toast.error(detail || 'Google sign-in failed. Please try again.');
        navigate('/auth', { replace: true });
      }
    })();
  }, [location.hash, location.search, login, navigate]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 px-4 text-center">
      <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-orange-500 mb-4" />
      <p className="text-gray-800 font-semibold">Finishing Google sign-in…</p>
      <p className="text-sm text-gray-500 mt-1">This should only take a moment.</p>
    </div>
  );
};

export default AuthCallback;
