import React from 'react';
import { Button } from './ui/button';
import { toast } from 'sonner';

/**
 * Continue with Google using Emergent-managed OAuth.
 *
 * Important implementation details:
 * - Provider URL can be overridden per environment without changing source code.
 * - The callback always returns to this same site.
 * - Auth intent and terms version survive the external round-trip in sessionStorage.
 */
const GoogleSignInButton = ({ nextPath = '/dashboard', intentAction = null }) => {
  const handleClick = () => {
    const authBase = (process.env.REACT_APP_GOOGLE_AUTH_URL || 'https://auth.emergentagent.com').replace(/\/$/, '');

    try {
      const returnUrl = intentAction
        ? `${nextPath}${nextPath.includes('?') ? '&' : '?'}action=${encodeURIComponent(intentAction)}`
        : nextPath;
      sessionStorage.setItem('sendjet_auth_next', returnUrl);
      // Clicking this button is paired with the visible terms notice below it.
      sessionStorage.setItem('sendjet_google_terms_version', '2026-09');
    } catch (_) {
      // sessionStorage may be unavailable in strict/private browser modes.
      void 0;
    }

    if (typeof window !== 'undefined' && window.posthog) {
      try { window.posthog.capture('google_signin_started'); } catch (_) { void 0; }
    }

    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;
      const target = `${authBase}/?redirect=${encodeURIComponent(redirectUrl)}`;
      window.location.assign(target);
    } catch (error) {
      console.error('Unable to start Google sign-in:', error);
      toast.error('Could not start Google sign-in. Please try again.');
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        className="w-full min-h-11 h-auto py-2.5 font-medium border-gray-300 hover:bg-gray-50 flex items-center justify-center gap-3 whitespace-normal text-center"
        data-testid="google-signin-button"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 flex-shrink-0" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span className="text-gray-700">Continue with Google</span>
      </Button>
      <p className="text-[11px] sm:text-xs text-gray-500 text-center leading-relaxed px-1">
        By continuing with Google, you agree to our{' '}
        <a href="/legal#terms" className="text-orange-600 hover:underline">Terms of Use</a>
        {' '}and{' '}
        <a href="/legal#privacy" className="text-orange-600 hover:underline">Privacy Policy</a>.
      </p>
    </div>
  );
};

export default GoogleSignInButton;
