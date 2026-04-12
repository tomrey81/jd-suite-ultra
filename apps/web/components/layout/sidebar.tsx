'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/',          icon: '⌂',  label: 'Workspace' },
  { href: '/company',   icon: '◎',  label: 'Company Profile' },
  { href: '/sources',   icon: '⊕',  label: 'External Sources' },
  { href: '/rasci',     icon: '⊞',  label: 'Process Intelligence' },
];

const WORKFLOW_ITEMS = [
  { href: '/analyse',      icon: '⌖',  label: 'JD Analyser' },
  { href: '/jd/new',       icon: '✦',  label: 'JD Builder' },
  { href: '/studio',       icon: '♫',  label: 'JD Studio' },
  { href: '/compare',      icon: '⇄',  label: 'JD Compare' },
];

const STRATEGY_ITEMS = [
  { href: '/pay-groups',   icon: '⊜',  label: 'Pay Groups', badge: 'EUPTD' },
  { href: '/architecture', icon: '◈',  label: 'Architecture Matrix' },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/'
      ? pathname === '/'
      : pathname === href || pathname.startsWith(href + '/');

  return (
    <aside className="flex h-full w-[214px] shrink-0 flex-col border-r border-white/5 bg-surface-nav overflow-y-auto">
      {/* Brand */}
      <div className="shrink-0 border-b border-white/5 px-4 pb-3.5 pt-[18px]">
        <div className="font-display text-base text-text-on-dark">Quadrance</div>
        <div className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-brand-gold">
          JD Suite · v4.1 Premium
        </div>
      </div>

      {/* Main Nav */}
      <nav className="shrink-0 border-b border-white/5 py-2">
        {NAV_ITEMS.map(({ href, icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex w-full items-center gap-[9px] border-l-2 px-4 py-2 text-xs transition-colors',
                active
                  ? 'border-brand-gold bg-white/5 text-text-on-dark'
                  : 'border-transparent text-white/40 hover:text-white/60',
              )}
            >
              <span className={cn('text-[13px]', active ? 'text-brand-gold' : 'text-white/25')}>
                {icon}
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* JD Workflows */}
      <div className="shrink-0 border-b border-white/5 py-2.5">
        <div className="px-4 pb-2 text-[9px] uppercase tracking-[0.1em] text-white/20">
          JD Workflows
        </div>
        {WORKFLOW_ITEMS.map(({ href, icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex w-full items-center gap-2 border-l-2 px-4 py-[7px] text-[11px] transition-colors',
                active
                  ? 'border-brand-gold bg-white/5 text-text-on-dark'
                  : 'border-transparent text-white/40 hover:text-white/60',
              )}
            >
              <span className={cn('text-[12px]', active ? 'text-brand-gold' : 'text-white/25')}>
                {icon}
              </span>
              {label}
            </Link>
          );
        })}
      </div>

      {/* Strategy & Compliance */}
      <div className="flex-1 py-2.5">
        <div className="px-4 pb-2 text-[9px] uppercase tracking-[0.1em] text-white/20">
          Strategy & Compliance
        </div>
        {STRATEGY_ITEMS.map(({ href, icon, label, badge }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex w-full items-center gap-2 border-l-2 px-4 py-[7px] text-[11px] transition-colors',
                active
                  ? 'border-brand-gold bg-white/5 text-text-on-dark'
                  : 'border-transparent text-white/40 hover:text-white/60',
              )}
            >
              <span className={cn('text-[12px]', active ? 'text-brand-gold' : 'text-white/25')}>
                {icon}
              </span>
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="shrink-0 rounded border border-brand-gold/40 px-1 py-0 text-[7px] font-bold uppercase tracking-wide text-brand-gold/60">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Bottom */}
      <div className="shrink-0 border-t border-white/5 px-4 py-3">
        <div className="text-[9px] text-white/15">Origometrics Platform</div>
      </div>
    </aside>
  );
}
