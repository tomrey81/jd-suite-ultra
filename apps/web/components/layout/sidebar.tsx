'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Item { href: string; icon: string; label: string; badge?: string; }
interface Group { id: string; label: string; icon: string; matcher?: string[]; items: Item[]; defaultOpen?: boolean; }

const GROUPS: Group[] = [
  // 0. Let's start — onboarding + about
  {
    id: 'start',
    label: "Let's start",
    icon: '★',
    matcher: ['/about', '/guide'],
    defaultOpen: true,
    items: [
      { href: '/about',  icon: 'ⓘ',  label: 'About the tool' },
      { href: '/guide',  icon: '📖', label: 'Best Practices' },
    ],
  },
  // 1. JD Hub — central workspace for all JD work
  {
    id: 'hub',
    label: 'JD Hub',
    icon: '◇',
    matcher: ['/', '/jd', '/analyser', '/editor', '/jd-editor', '/templates', '/rubric', '/v5'],
    defaultOpen: true,
    items: [
      { href: '/',              icon: '⌂',  label: 'Dashboard' },
      { href: '/jd',            icon: '◇',  label: 'All JDs' },
      { href: '/jd/input',      icon: '↑',  label: 'Upload Job Description' },
      { href: '/jd-editor',     icon: '✦',  label: 'Job Description Editor' },
      { href: '/templates',     icon: '⊡',  label: 'Job Description Template' },
    ],
  },
  // 2. Org Structure
  {
    id: 'org',
    label: 'Org Structure',
    icon: '⌬',
    matcher: ['/pmoa', '/company', '/architecture'],
    defaultOpen: false,
    items: [
      { href: '/company',          icon: '◎',  label: 'Company Profile' },
      { href: '/pmoa',             icon: '⊞',  label: 'PMOA dashboard' },
      { href: '/pmoa/org',         icon: '⌬',  label: 'Org map' },
      { href: '/architecture',     icon: '◈',  label: 'Job Architecture Matrix' },
    ],
  },
  // 3. Processes & Documents
  {
    id: 'process',
    label: 'Processes & Documents',
    icon: '⊞',
    matcher: ['/pmoa/processes', '/sources'],
    defaultOpen: false,
    items: [
      { href: '/pmoa/processes',   icon: '◇',  label: 'Processes & RASCI' },
      { href: '/sources',          icon: '⊕',  label: 'Live job openings' },
    ],
  },
  // 4. Final Review
  {
    id: 'review',
    label: 'Final Review',
    icon: '⊙',
    matcher: ['/compare', '/jd-versioning', '/audit', '/command-center'],
    defaultOpen: false,
    items: [
      { href: '/command-center',  icon: '◎',  label: 'Command Center' },
      { href: '/jd-versioning',   icon: '⇄',  label: 'Job Descriptions Versioning' },
      { href: '/audit',           icon: '⊙',  label: 'Audit trail' },
    ],
  },
  // 5. Strategy & Compliance
  {
    id: 'strategy',
    label: 'Strategy & Compliance',
    icon: '⚖',
    matcher: ['/pay-groups', '/euptd-readiness'],
    defaultOpen: false,
    items: [
      { href: '/euptd-readiness',  icon: '⚖',  label: 'EUPTD Readiness', badge: 'NEW' },
      { href: '/pay-groups',       icon: '⊜',  label: 'Pay Groups', badge: 'EUPTD' },
    ],
  },
  // 6. Sonification (Sonificator — single unified page)
  {
    id: 'studio',
    label: 'Sonification',
    icon: '♫',
    matcher: ['/studio'],
    defaultOpen: false,
    items: [
      { href: '/studio',          icon: '♫',  label: 'Sonificator' },
    ],
  },
];

export function Sidebar({ compact = false }: { compact?: boolean } = {}) {
  const pathname = usePathname();

  const initialOpen = Object.fromEntries(
    GROUPS.map((g) => [
      g.id,
      g.defaultOpen || (g.matcher?.some((m) => (m === '/' ? pathname === '/' : pathname.startsWith(m))) ?? false),
    ]),
  );
  const [open, setOpen] = useState<Record<string, boolean>>(initialOpen);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  const toggleGroup = (id: string) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));

  // Icon-only compact mode (Notion-style)
  if (compact) {
    // Flatten items, keep first-of-group as visual anchor
    const flat: { href: string; icon: string; label: string }[] = [];
    for (const g of GROUPS) {
      for (const it of g.items) flat.push(it);
    }
    return (
      <aside className="flex h-full w-[56px] shrink-0 flex-col items-center bg-surface-nav overflow-y-auto py-3">
        <Link href="/" className="mb-3 block" title="JD Suite">
          <span className="font-display text-[10px] tracking-[0.2em] text-text-on-dark/80">JD</span>
        </Link>
        <div className="mx-auto h-px w-8 bg-white/[0.06]" />
        <nav className="mt-2 flex flex-1 flex-col items-center gap-0.5 overflow-y-auto">
          {flat.map(({ href, icon, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-label={label}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-md text-[13px] transition-colors',
                  active
                    ? 'bg-white/[0.08] text-brand-gold'
                    : 'text-white/35 hover:bg-white/[0.04] hover:text-white/70',
                )}
              >
                {icon}
              </Link>
            );
          })}
        </nav>
        <div className="mx-auto h-px w-8 bg-white/[0.06]" />
        <Link
          href="/settings"
          title="Settings"
          aria-label="Settings"
          className={cn(
            'mt-2 flex h-9 w-9 items-center justify-center rounded-md text-[13px] transition-colors',
            isActive('/settings') ? 'bg-white/[0.08] text-brand-gold' : 'text-white/35 hover:bg-white/[0.04] hover:text-white/70',
          )}
        >
          ⚙
        </Link>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[214px] shrink-0 flex-col bg-surface-nav overflow-y-auto">
      {/* Brand */}
      <div className="shrink-0 px-5 pb-4 pt-5">
        <Link href="/" className="block">
          <span className="font-display text-[15px] tracking-[0.22em] text-text-on-dark/90">
            JD SUITE
          </span>
        </Link>
        <div className="mt-0.5 text-[9px] uppercase tracking-[0.15em] text-white/20">
          Compensation Intelligence
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-white/[0.06]" />

      {/* Groups */}
      <div className="flex-1 overflow-y-auto py-2">
        {GROUPS.map((g) => {
          const isOpen = open[g.id];
          const groupActive = g.matcher?.some((m) =>
            m === '/' ? pathname === '/' : pathname.startsWith(m),
          ) ?? false;
          return (
            <div key={g.id} className="mb-0.5">
              <button
                type="button"
                onClick={() => toggleGroup(g.id)}
                className={cn(
                  'flex w-full items-center gap-2 px-5 py-[9px] text-[10px] font-medium uppercase tracking-[0.13em] transition-colors',
                  groupActive ? 'text-brand-gold' : 'text-white/30 hover:text-white/50',
                )}
              >
                <span className="text-[11px]">{g.icon}</span>
                <span className="flex-1 text-left">{g.label}</span>
                <svg
                  width="8" height="8" viewBox="0 0 8 8"
                  className={cn('transition-transform duration-150', isOpen ? 'rotate-0' : '-rotate-90')}
                  fill="currentColor"
                >
                  <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                </svg>
              </button>
              {isOpen && (
                <div className="pb-1.5">
                  {g.items.map(({ href, icon, label, badge }) => {
                    const active = isActive(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          'flex w-full items-center gap-2.5 border-l-2 py-[6px] pl-7 pr-4 text-[11px] transition-colors',
                          active
                            ? 'border-brand-gold bg-white/[0.05] text-text-on-dark'
                            : 'border-transparent text-white/35 hover:text-white/55',
                        )}
                      >
                        <span className={cn('text-[11px]', active ? 'text-brand-gold' : 'text-white/20')}>
                          {icon}
                        </span>
                        <span className="flex-1 truncate">{label}</span>
                        {badge && (
                          <span className="shrink-0 rounded-full border border-brand-gold/30 px-1.5 py-px text-[7px] font-bold uppercase tracking-wide text-brand-gold/50">
                            {badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom */}
      <div className="mx-4 border-t border-white/[0.06]" />
      <div className="shrink-0 px-3 py-3 space-y-0.5">
        <Link
          href="/settings"
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md px-2 py-[7px] text-[11px] transition-colors',
            isActive('/settings') ? 'bg-white/[0.05] text-brand-gold' : 'text-white/30 hover:text-white/50',
          )}
        >
          <span className="text-[11px]">⚙</span>
          Settings
        </Link>
        <div className="mt-2 px-2 text-[8px] text-white/15">
          Built by{' '}
          <a
            href="https://www.linkedin.com/in/tomaszrey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-gold/50 hover:text-brand-gold/80"
          >
            Tomasz Rey
          </a>
        </div>
      </div>
    </aside>
  );
}
