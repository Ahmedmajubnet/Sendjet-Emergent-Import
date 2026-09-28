import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from './Navbar';
import { toast } from 'sonner';
import { Lock, CheckCircle2 } from 'lucide-react';

/**
 * /reset-password/:token — user lands here from their inbox. Enters a new
 * password twice, we POST /auth/reset-password, then bounce them to /auth.
 */
const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const strengthOk = pw.length >= 8;
  const match = pw && pw === pw2;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!strengthOk) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (!match) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await axios.post('/auth/reset-password', { token, new_password: pw });
      setDone(true);
      setTimeout(() => navigate('/auth', { replace: true }), 2500);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'This reset link is no longer valid.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <main id="main-content" className="max-w-lg mx-auto px-4 sm:px-6 py-20">
        <div className="bg-white rounded-3xl border border-hairline/60 shadow-soft p-10">
          {!done ? (
            <>
              <Lock className="w-10 h-10 text-brand" strokeWidth={1.5} />
              <h1 className="font-serif text-3xl text-ink mt-6">Choose a new password</h1>
              <p className="mt-3 text-ink2 leading-relaxed">
                Make it at least 8 characters. Use something you&apos;ll remember but nobody else can guess.
              </p>
              <form onSubmit={onSubmit} className="mt-8 space-y-4" data-testid="reset-password-form">
                <label className="block">
                  <span className="text-sm font-medium text-ink">New password</span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-hairline focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none px-4 py-3 text-ink"
                    data-testid="reset-password-new"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-ink">Confirm new password</span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-hairline focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none px-4 py-3 text-ink"
                    data-testid="reset-password-confirm"
                  />
                </label>
                {pw && !strengthOk && (
                  <p className="text-sm text-terra">Password must be at least 8 characters.</p>
                )}
                {pw2 && !match && (
                  <p className="text-sm text-terra">Passwords do not match.</p>
                )}
                <button
                  type="submit"
                  disabled={loading || !strengthOk || !match}
                  className="w-full inline-flex justify-center items-center bg-brand hover:bg-brand-hover disabled:opacity-60 text-white rounded-full px-8 py-3 font-medium transition"
                  data-testid="reset-password-submit"
                >
                  {loading ? 'Saving…' : 'Save new password'}
                </button>
              </form>
              <div className="mt-6 text-center">
                <Link to="/auth" className="text-sm text-ink2 hover:text-ink">Back to sign in</Link>
              </div>
            </>
          ) : (
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 text-brand mx-auto" strokeWidth={1.5} />
              <h1 className="font-serif text-3xl text-ink mt-6">Password updated</h1>
              <p className="mt-3 text-ink2 leading-relaxed">Redirecting you to sign in…</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ResetPasswordPage;
