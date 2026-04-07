'use client';

import { signOut } from 'next-auth/react';

interface HeaderProps {
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="flex h-[54px] shrink-0 items-center justify-between bg-surface-header px-5">
      <div className="flex items-center gap-3">
        <div>
          <div className="font-display text-[15px] font-semibold text-text-on-dark">
            Quadrance <span className="text-brand-gold-light">JD Suite</span>
          </div>
          <div className="text-[9px] uppercase tracking-[0.12em] text-brand-gold opacity-70">
            Origometrics Platform
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-text-on-dark/50">{user.name || user.email}</span>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="rounded-md border border-white/10 px-3 py-1 text-xs text-text-on-dark/50 transition-colors hover:border-brand-gold hover:text-brand-gold"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
