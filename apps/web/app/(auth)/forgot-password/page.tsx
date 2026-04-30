'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    'w-full rounded-md border border-border-default bg-surface-page px-3 py-2.5 font-body text-sm text-text-primary outline-none focus:border-brand-gold';

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page py-10">
      <div className="w-full max-w-[440px] rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-1 font-display text-2xl font-bold text-text-primary">JD Suite</div>
        <div className="mb-6 text-xs font-semibold uppercase tracking-widest text-text-muted">
          Reset your password
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
              <strong>Check your inbox.</strong>
              <p className="mt-1 text-xs leading-relaxed">
                If an account exists for <strong>{email}</strong>, we&apos;ve sent a reset link.
                It expires in 30 minutes. If nothing arrives, check spam or try again.
              </p>
            </div>
            <Link href="/login" className="block text-center text-xs text-brand-gold underline hover:no-underline">
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>
            )}
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-primary">Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com" required className={inputCls} />
            </div>
            <button type="submit" disabled={loading || !email}
              className="w-full rounded-md bg-brand-gold px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-40">
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <div className="text-center text-xs text-text-muted">
              Remembered it?{' '}
              <Link href="/login" className="font-medium text-brand-gold">Sign in</Link>
            </div>
          </form>
        )}
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
