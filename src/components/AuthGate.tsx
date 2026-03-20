'use client';

import { useState, useEffect } from 'react';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [input, setInput] = useState('');
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Dev preview bypass — skip auth when ?preview=1 is in the URL
    if (process.env.NODE_ENV === 'development') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('preview') === '1') {
        setAuthenticated(true);
        setChecking(false);
        return;
      }
    }

    // Check if we have a valid session cookie by making an authenticated request
    fetch('/api/calendar', { credentials: 'include' })
      .then((res) => {
        if (res.ok) setAuthenticated(true);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = input.trim();
    if (!trimmed) return;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: trimmed }),
        credentials: 'include',
      });
      if (res.ok) {
        setAuthenticated(true);
      } else {
        setError('Invalid token');
      }
    } catch {
      setError('Login failed');
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-6 h-6 border-2 border-jarvis-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 p-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-jarvis-accent mb-1">JARVIS</h1>
            <p className="text-sm text-jarvis-text-muted">Enter your auth token to continue</p>
          </div>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Auth token"
            className="w-full px-4 py-3 rounded-lg bg-jarvis-bg border border-jarvis-border text-jarvis-text-primary placeholder-jarvis-text-dim focus:border-jarvis-accent focus:outline-none"
            autoFocus
          />
          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-jarvis-accent/10 border border-jarvis-accent/30 text-jarvis-accent hover:bg-jarvis-accent/20 transition-colors"
          >
            Enter
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
