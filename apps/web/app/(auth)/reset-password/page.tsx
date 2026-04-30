'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.push('/login?reset=ok'), 1500);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Reset failed');
      }
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    'w-full rounded-md border border-border-default bg-surface-page px-3 py-2.5 font-body text-sm text-text-primary outline-none focus:border-brand-gold';

  if (!token) {
    return (
      <div className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">
        Missing token. Request a new reset link from{' '}
        <Link href="/forgot-password" className="font-medium underline">forgot password</Link>.
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
        <strong>Password updated.</strong>
        <p className="mt-1 text-xs">Redirecting to sign-in…</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>}
      <div>
        <label className="mb-1 block text-xs font-semibold text-text-primary">New password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 12 characters" minLength={12} required className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-text-primary">Confirm new password</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat" minLength={12} required className={inputCls} />
      </div>
      <button type="submit" disabled={loading}
        className="w-full rounded-md bg-brand-gold px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-40">
        {loading ? 'Updating…' : 'Set new password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page py-10">
      <div className="w-full max-w-[440px] rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-1 font-display text-2xl font-bold text-text-primary">JD Suite</div>
        <div className="mb-6 text-xs font-semibold uppercase tracking-widest text-text-muted">
          Set a new password
        </div>
        <Suspense fallback={<div className="text-sm text-text-muted">Loading…</div>}>
          <ResetForm />
        </Suspense>
        <div className="mt-8 border-t border-border-default pt-4 text-center text-[10px] text-text-muted">
          Built by{' '}
          <a href="https://www.linkedin.com/in/tomaszrey" target="_blank" rel="noopener noreferrer"
            className="font-medium text-brand-gold hover:underline">
            Tomasz Rey
          </a>
        </div>
      </div>
    </div>
  );
}
