// Changes:
// - Switched from client-side password check (which required embedding the
//   password in the JS bundle via process.env.APP_PASSWORD) to server-side
//   verification via POST /api/auth.
// - On success: password is saved to localStorage and sent as x-app-password
//   on every subsequent /api/* request.
// - On app startup: silently re-verifies the saved password by calling
//   /api/auth again, so if the password was rotated server-side, cached
//   sessions are invalidated automatically.
import React, { useState, useEffect } from 'react';
import { Lock, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import {
  getSavedPassword,
  saveSavedPassword,
  clearSavedPassword,
  verifyPassword,
} from '../services/authClient';

interface PasswordGateProps {
  children: React.ReactNode;
}

export const PasswordGate: React.FC<PasswordGateProps> = ({ children }) => {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const saved = getSavedPassword();
    if (!saved) {
      setChecking(false);
      return;
    }
    verifyPassword(saved)
      .then((ok) => {
        if (cancelled) return;
        if (ok) {
          setUnlocked(true);
        } else {
          clearSavedPassword();
        }
      })
      .catch(() => {
        // Network error etc. — leave the gate shown, don't auto-unlock.
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const ok = await verifyPassword(input);
      if (ok) {
        saveSavedPassword(input);
        setUnlocked(true);
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'Could not reach the server. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = () => {
    clearSavedPassword();
    setUnlocked(false);
    setInput('');
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  if (unlocked) {
    return (
      <>
        {children}
        <button
          onClick={handleSignOut}
          className="fixed bottom-4 right-4 z-[200] text-xs text-slate-500 hover:text-slate-300 bg-slate-900/80 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-full shadow-lg transition-colors"
          title="Sign out"
        >
          Sign out
        </button>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-3 rounded-2xl shadow-lg shadow-indigo-500/30 mb-4">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-white">E-Commerce Studio</h1>
            <p className="text-sm text-slate-400 mt-1">Enter the access password to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Password"
                autoFocus
                autoComplete="current-password"
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || input.length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-medium rounded-xl py-3 transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking...
                </>
              ) : (
                'Unlock'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-600 mt-4">
          Access is limited to authorized users only.
        </p>
      </div>
    </div>
  );
};

export default PasswordGate;
