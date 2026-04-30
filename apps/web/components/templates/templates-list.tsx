'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface TemplateSummary {
  id: string;
  orgId: string | null;
  name: string;
  purpose: string;
  description: string;
  sections: any;
  isDefault: boolean;
  createdAt: string | Date;
  _count: { jds: number };
  createdBy: { name: string | null; email: string } | null;
}

interface Props {
  templates: TemplateSummary[];
  orgId: string | null;
}

export function TemplatesList({ templates, orgId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const duplicate = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${id}/duplicate`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${res.status})`);
      }
      const created = await res.json();
      router.refresh();
      router.push(`/templates/${created.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${res.status})`);
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-default bg-white p-12 text-center">
        <div className="text-[11px] uppercase tracking-wider text-text-muted">No templates yet</div>
        <p className="mt-2 text-sm text-text-secondary">
          Create your first JD Template to define how job descriptions are structured.
        </p>
        <Link
          href="/templates/new"
          className="mt-4 inline-block rounded-full bg-brand-gold px-4 py-2 text-xs font-medium text-white"
        >
          + New Template
        </Link>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-3 rounded-md border border-danger/30 bg-danger-bg p-2 text-xs text-danger">
          {error}
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
        {templates.map((t) => {
          const sections = (t.sections as any[]) || [];
          const fieldCount = sections.reduce((a: number, s: any) => a + (s.fields?.length || 0), 0);
          const requiredCount = sections.reduce(
            (a: number, s: any) => a + (s.fields?.filter((f: any) => f.required).length || 0),
            0,
          );
          const isSystem = t.orgId === null;
          const editable = !isSystem && t.orgId === orgId;

          return (
            <div
              key={t.id}
              className="flex flex-col rounded-xl border border-border-default bg-white p-5 transition-all hover:border-brand-gold/50 hover:shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    t.isDefault
                      ? 'bg-brand-gold/15 text-brand-gold'
                      : isSystem
                        ? 'bg-info-bg text-info'
                        : 'bg-surface-page text-text-muted'
                  }`}
                >
                  {t.isDefault ? 'Default' : isSystem ? 'System' : 'Custom'}
                </span>
                {t._count.jds > 0 && (
                  <span className="text-[10px] text-text-muted">In use by {t._count.jds} JD{t._count.jds === 1 ? '' : 's'}</span>
                )}
              </div>
              <h3 className="font-display text-base font-semibold text-text-primary">{t.name}</h3>
              {t.description && (
                <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-text-muted">
                  {t.description}
                </p>
              )}
              <div className="mt-3 flex items-center gap-3 text-[11px] text-text-muted">
                <span>{sections.length} sections</span>
                <span>·</span>
                <span>{fieldCount} fields</span>
                <span>·</span>
                <span>{requiredCount} required</span>
              </div>
              <div className="mt-4 flex gap-1.5">
                {editable ? (
                  <Link
                    href={`/templates/${t.id}`}
                    className="rounded-md border border-border-default px-3 py-1.5 text-[11px] font-medium text-text-secondary hover:border-brand-gold hover:text-brand-gold"
                  >
                    Edit
                  </Link>
                ) : (
                  <Link
                    href={`/templates/${t.id}`}
                    className="rounded-md border border-border-default px-3 py-1.5 text-[11px] font-medium text-text-muted hover:border-brand-gold/40"
                  >
                    View
                  </Link>
                )}
                <button
                  onClick={() => duplicate(t.id)}
                  disabled={busy === t.id}
                  className="rounded-md border border-border-default px-3 py-1.5 text-[11px] font-medium text-text-secondary hover:border-brand-gold disabled:opacity-50"
                >
                  Duplicate
                </button>
                {editable && t._count.jds === 0 && (
                  <button
                    onClick={() => remove(t.id, t.name)}
                    disabled={busy === t.id}
                    className="rounded-md border border-border-default px-3 py-1.5 text-[11px] font-medium text-danger/70 hover:border-danger hover:text-danger disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
