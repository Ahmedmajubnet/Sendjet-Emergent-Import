import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from './Navbar';
import { toast } from 'sonner';
import { Mail, Send } from 'lucide-react';

/**
 * /forgot-password — user requests a password-reset link. Always shows a
 * neutral success message (no user-enumeration).
 */
const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('/auth/request-password-reset', { email });
      setSent(true);
    } catch (_) {
      // Backend always returns 200 for this endpoint; a network error still
      // reaches here — show a friendly generic message.
      toast.error('Something went wrong. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <main id="main-content" className="max-w-lg mx-auto px-4 sm:px-6 py-20">
        <div className="bg-white rounded-3xl border border-hairline/60 shadow-soft p-10">
          {!sent ? (
            <>
              <Mail className="w-10 h-10 text-brand" strokeWidth={1.5} />
              <h1 className="font-serif text-3xl text-ink mt-6">Reset your password</h1>
              <p className="mt-3 text-ink2 leading-relaxed">
                Enter the email you use for SendJet and we&apos;ll send you a link to choose a new password.
              </p>
              <form onSubmit={onSubmit} className="mt-8 space-y-4" data-testid="forgot-password-form">
                <label className="block">
                  <span className="text-sm font-medium text-ink">Email</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-2 w-full rounded-xl border border-hairline focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none px-4 py-3 text-ink"
                    data-testid="forgot-password-email"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex justify-center items-center bg-brand hover:bg-brand-hover disabled:opacity-60 text-white rounded-full px-8 py-3 font-medium transition"
                  data-testid="forgot-password-submit"
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
              <div className="mt-6 text-center">
                <Link to="/auth" className="text-sm text-ink2 hover:text-ink">Back to sign in</Link>
              </div>
            </>
          ) : (
            <div className="text-center">
              <Send className="w-10 h-10 text-brand mx-auto" strokeWidth={1.5} />
              <h1 className="font-serif text-3xl text-ink mt-6">Check your inbox</h1>
              <p className="mt-3 text-ink2 leading-relaxed">
                If an account exists for <strong>{email}</strong>, we just sent a reset link.
                The link expires in 30 minutes.
              </p>
              <Link
                to="/auth"
                className="mt-8 inline-flex items-center bg-brand hover:bg-brand-hover text-white rounded-full px-8 py-3 font-medium transition"
                data-testid="forgot-password-back"
              >
                Back to sign in
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ForgotPasswordPage;
