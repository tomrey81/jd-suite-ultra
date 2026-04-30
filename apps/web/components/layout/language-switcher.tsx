'use client';

import { useEffect, useRef, useState } from 'react';

const LOCALES = [
  { code: 'en', label: 'English', flag: 'EN' },
  { code: 'pl', label: 'Polski', flag: 'PL' },
  { code: 'de', label: 'Deutsch', flag: 'DE' },
  { code: 'fr', label: 'Français', flag: 'FR' },
  { code: 'es', label: 'Español', flag: 'ES' },
  { code: 'sk', label: 'Slovenčina', flag: 'SK' },
  { code: 'cs', label: 'Čeština', flag: 'CS' },
  { code: 'ro', label: 'Română', flag: 'RO' },
  { code: 'sv', label: 'Svenska', flag: 'SV' },
] as const;

function readLocaleCookie(): string {
  if (typeof document === 'undefined') return 'en';
  const m = document.cookie.match(/(?:^|; )locale=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : 'en';
}

function writeLocaleCookie(code: string) {
  // 1 year, root path, lax
  document.cookie = `locale=${encodeURIComponent(code)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string>('en');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrent(readLocaleCookie());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const change = (code: string) => {
    if (code === current) {
      setOpen(false);
      return;
    }
    writeLocaleCookie(code);
    setCurrent(code);
    setOpen(false);
    // Soft reload so server-side next-intl picks up the new cookie
    window.location.reload();
  };

  const active = LOCALES.find((l) => l.code === current) ?? LOCALES[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Change language"
        aria-label="Change language"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 text-[10px] font-medium tracking-wide text-text-on-dark/70 transition-colors hover:bg-white/[0.12] hover:text-text-on-dark"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="6" cy="6" r="4.5" />
          <path d="M1.5 6h9M6 1.5c1.5 1.5 1.5 7.5 0 9M6 1.5c-1.5 1.5-1.5 7.5 0 9" strokeLinecap="round" />
        </svg>
        <span className="tabular-nums">{active.flag}</span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M2 3l2 2 2-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-44 overflow-hidden rounded-lg border border-border-default bg-white shadow-xl"
        >
          {LOCALES.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                role="option"
                aria-selected={l.code === current}
                onClick={() => change(l.code)}
                className={
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors hover:bg-surface-page' +
                  (l.code === current ? ' bg-brand-gold-lighter font-medium text-brand-gold' : ' text-text-primary')
                }
              >
                <span className="w-7 shrink-0 text-[10px] font-bold tracking-widest text-text-muted">{l.flag}</span>
                <span className="flex-1">{l.label}</span>
                {l.code === current && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 5l2 2 4-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
