'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { JobDescription, Template, User } from '@jd-suite/db';

type JDWithRelations = JobDescription & {
  owner: Pick<User, 'name' | 'email'>;
  _count: { comments: number; versions: number };
};

interface WorkspaceViewProps {
  jds: JDWithRelations[];
  templates: Template[];
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: 'bg-brand-gold-lighter', text: 'text-text-secondary' },
  UNDER_REVISION: { bg: 'bg-warning-bg', text: 'text-warning' },
  APPROVED: { bg: 'bg-success-bg', text: 'text-success' },
  ARCHIVED: { bg: 'bg-surface-page', text: 'text-text-muted' },
};

export function WorkspaceView({ jds, templates }: WorkspaceViewProps) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'templates'>('all');

  const filtered = jds.filter(
    (jd) =>
      !search || (jd.jobTitle || '').toLowerCase().includes(search.toLowerCase()),
  );

  const compliance = jds.length
    ? Math.round(
        (jds.filter((jd) => {
          const data = jd.data as Record<string, string>;
          const fields = Object.values(data).filter((v) => v && v.trim());
          return fields.length > 10;
        }).length /
          jds.length) *
          100,
      )
    : 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-8 pt-6">
        <div className="mb-4 flex items-start gap-4">
          <div className="flex-1">
            <h1 className="mb-1 font-display text-2xl font-bold text-text-primary">Workspace</h1>
            <div className="flex gap-4 text-xs text-text-muted">
              <span>{jds.length} job descriptions</span>
              <span>·</span>
              <span>{compliance}% compliance</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search JDs..."
              className="w-[180px] rounded-md border border-border-default bg-white px-3 py-[7px] font-body text-xs text-text-primary outline-none"
            />
            <Link
              href="/jd/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-surface-header px-4 py-[7px] text-xs font-medium text-text-on-dark"
            >
              ✦ New JD
            </Link>
            <Link
              href="/analyse"
              className="inline-flex items-center gap-1.5 rounded-md bg-cat-skills px-4 py-[7px] text-xs font-medium text-white"
            >
              ⌖ Analyse JD
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border-default">
          {(['all', 'templates'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-[18px] py-2 text-xs font-semibold transition-colors ${
                tab === t
                  ? 'border-b-2 border-brand-gold text-text-primary'
                  : 'border-b-2 border-transparent text-text-muted'
              }`}
            >
              {t === 'all' ? 'All JDs' : 'Templates'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 pb-8 pt-5">
        {tab === 'all' && (
          <div className="animate-fade-in grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-3.5">
            {/* New JD card */}
            <Link
              href="/jd/new"
              className="flex flex-col items-center gap-2.5 rounded-lg border-2 border-dashed border-border-default p-7 text-text-muted transition-colors hover:border-brand-gold"
            >
              <span className="text-2xl">+</span>
              <span className="text-xs font-semibold">New Job Description</span>
            </Link>

            {/* JD cards */}
            {filtered.map((jd) => {
              const colors = STATUS_COLORS[jd.status] || STATUS_COLORS.DRAFT;
              return (
                <Link
                  key={jd.id}
                  href={`/jd/${jd.id}`}
                  className="group rounded-lg border border-border-default bg-white p-[18px] transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="mb-2.5 flex items-start justify-between">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold ${colors.bg} ${colors.text}`}
                    >
                      {jd.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="mb-0.5 font-display text-[0.95rem] font-semibold leading-tight text-text-primary">
                    {jd.jobTitle || 'Untitled Role'}
                  </div>
                  <div className="mb-3 text-[11px] text-text-muted">
                    {jd.orgUnit || 'No unit'} · {formatDate(jd.updatedAt)}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-text-muted">
                    {jd._count.comments > 0 && <span>{jd._count.comments} comments</span>}
                    {jd._count.versions > 0 && <span>{jd._count.versions} changes</span>}
                  </div>
                </Link>
              );
            })}

            {filtered.length === 0 && jds.length > 0 && (
              <div className="col-span-full py-10 text-center text-sm text-text-muted">
                No JDs matching &quot;{search}&quot;
              </div>
            )}

            {jds.length === 0 && (
              <div className="col-span-full rounded-lg border border-dashed border-border-default bg-white p-8 text-center text-xs text-text-muted">
                No saved JDs yet. Start with JD Builder or JD Analyser.
              </div>
            )}
          </div>
        )}

        {tab === 'templates' && (
          <div className="animate-fade-in grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3.5">
            {templates.map((t) => {
              const sections = (t.sections as any[]) || [];
              const fieldCount = sections.reduce(
                (a: number, s: any) => a + (s.fields?.length || 0),
                0,
              );
              return (
                <div
                  key={t.id}
                  className="rounded-lg border border-border-default bg-white p-[18px]"
                >
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-gold">
                    {t.isDefault ? 'Default' : 'Custom'}
                  </div>
                  <div className="mb-1 font-display text-[0.95rem] font-semibold text-text-primary">
                    {t.name}
                  </div>
                  <div className="mb-2.5 text-[11px] text-text-muted">
                    {sections.length} sections · {fieldCount} fields
                  </div>
                  <Link
                    href="/jd/new"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border-default px-3 py-1 text-[11px] text-text-secondary transition-colors hover:border-brand-gold"
                  >
                    Use template
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
