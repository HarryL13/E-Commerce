// Changes:
// - Surface real auth errors from verifyPassword (e.g. missing .dev.vars).
// - Server-side password verification via POST /api/auth.
// - Professional light login screen matching studio UI.
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
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setUnlocked(true);
        else clearSavedPassword();
      })
      .catch(() => {})
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
      const result = await verifyPassword(input);
      if (result.ok) {
        saveSavedPassword(input.trim());
        setUnlocked(true);
      } else {
        setError('error' in result ? result.error : 'Incorrect password. Please try again.');
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
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (unlocked) {
    return (
      <>
        {children}
        <button
          onClick={handleSignOut}
          className="fixed bottom-4 right-4 z-[200] text-xs text-zinc-500 hover:text-zinc-700 bg-white/90 backdrop-blur border border-zinc-200 px-3 py-1.5 rounded-full shadow-sm transition-colors"
          title="Sign out"
        >
          Sign out
        </button>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-lg p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-sm mb-4">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-zinc-900">E-Commerce Studio</h1>
            <p className="text-sm text-zinc-500 mt-1">Enter the access password to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Password"
                autoFocus
                autoComplete="current-password"
                className="studio-input pl-10"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || input.length === 0}
              className="w-full btn-primary py-3 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:shadow-none"
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

        <p className="text-center text-[11px] text-zinc-400 mt-4">
          Access is limited to authorized users only.
        </p>
      </div>
    </div>
  );
};

export default PasswordGate;
