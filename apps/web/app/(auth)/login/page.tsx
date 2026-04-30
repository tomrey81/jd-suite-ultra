'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

type Mode = 'password' | 'magic';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const justReset = searchParams.get('reset') === 'ok';
  const justRegistered = searchParams.get('registered') === 'true';

  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const result = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError('Invalid email or password.');
    } else {
      router.push(callbackUrl);
    }
  };

  const handleMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setMagicSent(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not send link');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full rounded-md border border-border-default bg-surface-page px-3 py-2.5 font-body text-sm text-text-primary outline-none focus:border-brand-gold';

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page py-10">
      <div className="w-full max-w-[440px] rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-6 font-display text-2xl font-bold text-text-primary">JD Suite</div>

        {justReset && (
          <div className="mb-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800">
            Password updated. Sign in below.
          </div>
        )}
        {justRegistered && (
          <div className="mb-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800">
            Account created. You can sign in now.
          </div>
        )}

        {/* Mode toggle */}
        <div className="mb-4 flex gap-1 rounded-md border border-border-default p-1 bg-surface-page">
          <button type="button" onClick={() => { setMode('password'); setMagicSent(false); setError(''); }}
            className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'password' ? 'bg-white text-text-primary shadow-sm' : 'text-text-muted'}`}>
            Password
          </button>
          <button type="button" onClick={() => { setMode('magic'); setError(''); }}
            className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${mode === 'magic' ? 'bg-white text-text-primary shadow-sm' : 'text-text-muted'}`}>
            ✨ Magic link
          </button>
        </div>

        {mode === 'password' ? (
          <form onSubmit={handlePassword} className="space-y-4">
            {error && <div className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>}
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-primary">Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com" required className={inputCls} />
            </div>
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <label className="text-xs font-semibold text-text-primary">Password</label>
                <Link href="/forgot-password" className="text-[10px] text-brand-gold hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password" required minLength={8} className={inputCls} />
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-md bg-brand-gold px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-40">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : magicSent ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
              <strong>Check your inbox.</strong>
              <p className="mt-1 text-xs leading-relaxed">
                If an account exists for <strong>{email}</strong>, we&apos;ve sent a one-time sign-in link.
                It expires in 15 minutes.
              </p>
            </div>
            <button type="button" onClick={() => { setMagicSent(false); setEmail(''); }}
              className="text-xs text-brand-gold hover:underline">
              ← Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleMagic} className="space-y-4">
            {error && <div className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>}
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-primary">Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com" required className={inputCls} />
              <p className="mt-1.5 text-[10px] leading-relaxed text-text-muted">
                We&apos;ll email you a link that signs you in instantly. No password needed.
              </p>
            </div>
            <button type="submit" disabled={loading || !email}
              className="w-full rounded-md bg-text-primary px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-40">
              {loading ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-brand-gold">Create one</Link>
        </div>

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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
