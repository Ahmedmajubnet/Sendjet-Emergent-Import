import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from './Navbar';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

/**
 * /verify-email/:token — user lands here after clicking the confirm link.
 * Auto-calls the backend, shows success or a helpful failure state.
 */
const VerifyEmailPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading', email: null, alreadyVerified: false, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.post('/auth/verify-email', { token });
        if (!cancelled) {
          setState({ status: 'ok', email: res.data.email, alreadyVerified: !!res.data.already_verified, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            email: null,
            alreadyVerified: false,
            error: err.response?.data?.detail || 'Verification link is invalid or has expired.'
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <main id="main-content" className="max-w-lg mx-auto px-4 sm:px-6 py-24 text-center">
        <div className="bg-white rounded-3xl border border-hairline/60 shadow-soft p-10">
          {state.status === 'loading' && (
            <>
              <Loader2 className="w-8 h-8 text-brand mx-auto animate-spin" strokeWidth={1.5} />
              <p className="mt-6 text-ink2">Confirming your email…</p>
            </>
          )}
          {state.status === 'ok' && (
            <>
              <CheckCircle2 className="w-12 h-12 text-brand mx-auto" strokeWidth={1.5} />
              <h1 className="font-serif text-3xl text-ink mt-6">
                {state.alreadyVerified ? 'Already confirmed' : 'Email confirmed'}
              </h1>
              <p className="mt-3 text-ink2 leading-relaxed">
                {state.alreadyVerified
                  ? `We already have ${state.email} verified.`
                  : `Thanks — ${state.email} is now verified. Welcome to SendJet.`}
              </p>
              <button
                data-testid="verify-continue"
                onClick={() => navigate('/dashboard')}
                className="mt-8 inline-flex items-center bg-brand hover:bg-brand-hover text-white rounded-full px-8 py-3 font-medium transition"
              >
                Continue to dashboard
              </button>
            </>
          )}
          {state.status === 'error' && (
            <>
              <AlertTriangle className="w-12 h-12 text-terra mx-auto" strokeWidth={1.5} />
              <h1 className="font-serif text-3xl text-ink mt-6">Link no longer valid</h1>
              <p className="mt-3 text-ink2 leading-relaxed">{state.error}</p>
              <Link
                to="/auth"
                className="mt-8 inline-flex items-center bg-brand hover:bg-brand-hover text-white rounded-full px-8 py-3 font-medium transition"
                data-testid="verify-back-to-auth"
              >
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default VerifyEmailPage;
