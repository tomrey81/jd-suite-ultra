'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const COUNTRIES = [
  'Poland', 'Germany', 'United Kingdom', 'France', 'Spain', 'Italy', 'Netherlands',
  'Belgium', 'Czech Republic', 'Slovakia', 'Hungary', 'Romania', 'Austria', 'Switzerland',
  'Denmark', 'Sweden', 'Norway', 'Finland', 'Ireland', 'Portugal', 'Greece',
  'United States', 'Canada', 'Brazil', 'Mexico', 'India', 'Australia', 'Other',
];

const FUNCTIONS = [
  'Total Rewards', 'Compensation & Benefits', 'HR Business Partner', 'People Operations',
  'Reward & Recognition', 'Payroll', 'Talent Acquisition', 'Learning & Development',
  'HR Technology', 'Organisational Development', 'HR Director / CHRO',
  'Compliance / Pay Equity', 'Consulting', 'Other',
];

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [country, setCountry] = useState('');
  const [jobFunction, setJobFunction] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [dataConsent, setDataConsent] = useState(false);
  const [tosAccept, setTosAccept] = useState(false);
  const [privacyAccept, setPrivacyAccept] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!dataConsent || !tosAccept || !privacyAccept) {
      setError('Please accept the required consents (data processing, Terms, Privacy) to continue.');
      return;
    }
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName, lastName, email, password, orgName,
          country, jobFunction, accessCode,
          dataConsent: true, tosAccept: true, privacyAccept: true,
          marketingOptIn, newsletterOptIn,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      router.push('/login?registered=true');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const inputCls =
    'w-full rounded-md border border-border-default bg-surface-page px-3 py-2.5 font-body text-sm text-text-primary outline-none focus:border-brand-gold';

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page py-10">
      <div className="w-full max-w-[520px] rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-1 font-display text-2xl font-bold text-text-primary">JD Suite</div>
        <div className="mb-6 text-xs font-semibold uppercase tracking-widest text-text-muted">
          Create your account
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && (
            <div className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-primary">First name</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-primary">Last name</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className={inputCls} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-primary">Corporate email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required className={inputCls} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-primary">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 12 characters" required minLength={12} className={inputCls} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-primary">Organisation</label>
            <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. EUPTD Enterprises" required className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-primary">Country</label>
              <select value={country} onChange={(e) => setCountry(e.target.value)} required className={inputCls}>
                <option value="">— Select —</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-text-primary">Function</label>
              <select value={jobFunction} onChange={(e) => setJobFunction(e.target.value)} required className={inputCls}>
                <option value="">— Select —</option>
                {FUNCTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-text-primary">Access code</label>
            <input type="text" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Provided by Tomasz" required className={inputCls + ' font-mono uppercase tracking-wider'} />
            <p className="mt-1 text-[10px] text-text-muted">Required for early access. Contact Tomasz on LinkedIn if you don&apos;t have one.</p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="rounded-md bg-surface-page p-2.5">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Required to create an account
              </div>
              <div className="space-y-1.5">
                <label className="flex items-start gap-2 text-[11px] leading-tight text-text-secondary">
                  <input type="checkbox" checked={dataConsent} onChange={(e) => setDataConsent(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand-gold" />
                  <span>
                    I consent to the processing of my personal data for account creation and platform operation,
                    in accordance with GDPR (Art. 6(1)(b)). JD content stays private to my organisation.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-[11px] leading-tight text-text-secondary">
                  <input type="checkbox" checked={tosAccept} onChange={(e) => setTosAccept(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand-gold" />
                  <span>
                    I have read and accept the{' '}
                    <a href="/legal/terms" target="_blank" className="text-brand-gold underline">Terms of Service</a>.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-[11px] leading-tight text-text-secondary">
                  <input type="checkbox" checked={privacyAccept} onChange={(e) => setPrivacyAccept(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand-gold" />
                  <span>
                    I have read and accept the{' '}
                    <a href="/legal/privacy" target="_blank" className="text-brand-gold underline">Privacy Policy</a>.
                  </span>
                </label>
              </div>
            </div>

            <div className="rounded-md border border-border-default p-2.5">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Optional — you can change these in Settings any time
              </div>
              <div className="space-y-1.5">
                <label className="flex items-start gap-2 text-[11px] leading-tight text-text-secondary">
                  <input type="checkbox" checked={newsletterOptIn} onChange={(e) => setNewsletterOptIn(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand-gold" />
                  <span>
                    Subscribe me to the monthly newsletter — Total Rewards trends, EU Pay Transparency briefings,
                    new product features. Unsubscribe anytime.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-[11px] leading-tight text-text-secondary">
                  <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand-gold" />
                  <span>
                    Send me occasional marketing emails about events, partner offers, and case studies.
                  </span>
                </label>
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full rounded-md bg-brand-gold px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-40">
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-text-muted">
          Already have an account?{' '}
          <a href="/login" className="font-medium text-brand-gold">Sign in</a>
        </div>

        <div className="mt-8 border-t border-border-default pt-4 text-center text-[10px] text-text-muted">
          Built by{' '}
          <a href="https://www.linkedin.com/in/tomaszrey" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-gold hover:underline">
            Tomasz Rey
          </a>
        </div>
      </div>
    </div>
  );
}
