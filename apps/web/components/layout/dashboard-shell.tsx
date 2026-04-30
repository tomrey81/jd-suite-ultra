'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from './sidebar';

const LS_KEY = 'jdgc_sidebar_collapsed';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (raw === '1') setCollapsed(true);
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try { window.localStorage.setItem(LS_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // ⌘\ / ctrl+\  to toggle  (same binding Notion uses)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  const fullWidth = 214;
  const iconWidth = 56;
  const currentWidth = hydrated && collapsed ? iconWidth : fullWidth;

  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* Sidebar wrapper — width animates between full + icons-only (Notion-style) */}
      <div
        className="relative shrink-0 overflow-hidden transition-[width] duration-200 ease-out"
        style={{ width: currentWidth }}
      >
        <Sidebar compact={hydrated && collapsed} />
      </div>

      {/* Toggle button — sits at the boundary, flips direction on state */}
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={`${collapsed ? 'Expand' : 'Collapse'} sidebar (⌘\\)`}
        className="absolute top-3 z-20 flex h-6 w-6 items-center justify-center rounded-md border border-border-default bg-white text-text-secondary shadow-sm transition-all duration-200 hover:bg-surface-page hover:text-text-primary hover:shadow"
        style={{
          left: currentWidth - 12,
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="transition-transform duration-200"
          style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
        >
          <path
            d="M4 2.5L7.5 6L4 9.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface-page">
        {children}
      </main>
    </div>
  );
}
