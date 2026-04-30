'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/jd',      label: 'Workflow',         description: '5-step input → review → tweak → compare → output' },
  { href: '/',        label: 'Library',          description: 'All saved JDs, folders, search, status' },
  { href: '/sources', label: 'Live Job Openings', description: 'Adzuna search + scrape careers pages' },
];

/**
 * Cross-navigation pill for the JD Hub super-module.
 * Surfaced on /, /jd, and /sources to make the three views feel like one tool.
 */
export function HubNav() {
  const pathname = usePathname();
  return (
    <div className="mx-auto mb-5 flex max-w-fit items-center gap-1 rounded-full border border-border-default bg-white p-1">
      {TABS.map((t) => {
        const active =
          t.href === '/' ? pathname === '/' :
          t.href === '/jd' ? pathname === '/jd' :
          pathname === t.href || pathname.startsWith(t.href + '/');
        return (
          <Link
            key={t.href}
            href={t.href}
            title={t.description}
            className={cn(
              'rounded-full px-4 py-1.5 text-[11px] font-medium transition-colors',
              active
                ? 'bg-brand-gold text-white'
                : 'text-text-muted hover:bg-surface-page hover:text-text-primary',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
