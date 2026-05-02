'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const SOCIAL_PROVIDERS = [
  { id: 'google', label: 'Continue with Google', icon: GoogleIcon },
] as const;

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}


function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const justReset = searchParams.get('reset') === 'ok';
  const justRegistered = searchParams.get('registered') === 'true';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

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

  const handleSocial = (provider: string) => {
    setSocialLoading(provider);
    signIn(provider, { callbackUrl });
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

        {/* Social auth */}
        <div className="flex flex-col gap-2 mb-5">
          {SOCIAL_PROVIDERS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              disabled={!!socialLoading}
              onClick={() => handleSocial(id)}
              className="flex items-center justify-center gap-2 rounded-md border border-border-default bg-white px-3 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-page disabled:opacity-40"
            >
              <Icon />
              {socialLoading === id ? '…' : label}
            </button>
          ))}
        </div>

        <div className="relative mb-5">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border-default" /></div>
          <div className="relative flex justify-center"><span className="bg-white px-3 text-[10px] text-text-muted">or sign in with email</span></div>
        </div>

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
