'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Field {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  hint?: string;
  rows?: number;
  opts?: string[];
  ai?: boolean;
  priority?: string;
}

interface Section {
  id: string;
  title: string;
  desc?: string;
  required?: boolean;
  fields: Field[];
}

interface TemplateData {
  id: string;
  name: string;
  purpose: string;
  description: string;
  sections: Section[];
  isDefault: boolean;
  orgId: string | null;
}

interface Props {
  mode: 'create' | 'edit' | 'view';
  orgId: string | null;
  initial: TemplateData;
}

const FIELD_TYPES = ['text', 'textarea', 'date', 'select', 'radio'];

export function TemplateEditor({ mode, initial }: Props) {
  const router = useRouter();
  const [data, setData] = useState<TemplateData>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const isReadOnly = mode === 'view';

  const updateData = (patch: Partial<TemplateData>) => {
    setData((d) => ({ ...d, ...patch }));
    setSavedNotice(false);
  };

  const updateSection = (idx: number, patch: Partial<Section>) => {
    setData((d) => {
      const next = [...d.sections];
      next[idx] = { ...next[idx], ...patch };
      return { ...d, sections: next };
    });
    setSavedNotice(false);
  };

  const updateField = (sIdx: number, fIdx: number, patch: Partial<Field>) => {
    setData((d) => {
      const sections = [...d.sections];
      const fields = [...sections[sIdx].fields];
      fields[fIdx] = { ...fields[fIdx], ...patch };
      sections[sIdx] = { ...sections[sIdx], fields };
      return { ...d, sections };
    });
    setSavedNotice(false);
  };

  const addSection = () => {
    setData((d) => ({
      ...d,
      sections: [
        ...d.sections,
        {
          id: `S${d.sections.length + 1}`,
          title: 'New Section',
          desc: '',
          required: false,
          fields: [],
        },
      ],
    }));
  };

  const removeSection = (idx: number) => {
    if (!confirm(`Remove section "${data.sections[idx].title}"?`)) return;
    setData((d) => ({ ...d, sections: d.sections.filter((_, i) => i !== idx) }));
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= data.sections.length) return;
    setData((d) => {
      const sections = [...d.sections];
      [sections[idx], sections[newIdx]] = [sections[newIdx], sections[idx]];
      return { ...d, sections };
    });
  };

  const addField = (sIdx: number) => {
    setData((d) => {
      const sections = [...d.sections];
      const fields = [...sections[sIdx].fields];
      fields.push({
        id: `field_${Date.now()}`,
        label: 'New Field',
        type: 'text',
        required: false,
        hint: '',
      });
      sections[sIdx] = { ...sections[sIdx], fields };
      return { ...d, sections };
    });
  };

  const removeField = (sIdx: number, fIdx: number) => {
    setData((d) => {
      const sections = [...d.sections];
      const fields = sections[sIdx].fields.filter((_, i) => i !== fIdx);
      sections[sIdx] = { ...sections[sIdx], fields };
      return { ...d, sections };
    });
  };

  const moveField = (sIdx: number, fIdx: number, dir: -1 | 1) => {
    const newIdx = fIdx + dir;
    const fields = data.sections[sIdx].fields;
    if (newIdx < 0 || newIdx >= fields.length) return;
    setData((d) => {
      const sections = [...d.sections];
      const f = [...sections[sIdx].fields];
      [f[fIdx], f[newIdx]] = [f[newIdx], f[fIdx]];
      sections[sIdx] = { ...sections[sIdx], fields: f };
      return { ...d, sections };
    });
  };

  const save = async () => {
    if (!data.name.trim()) {
      setError('Name is required');
      return;
    }
    if (data.sections.length === 0) {
      setError('At least one section is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: data.name,
        purpose: data.purpose,
        description: data.description,
        sections: data.sections,
        isDefault: data.isDefault,
      };

      if (mode === 'create') {
        const res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Failed (${res.status})`);
        }
        const created = await res.json();
        router.push(`/templates/${created.id}`);
        router.refresh();
      } else {
        const res = await fetch(`/api/templates/${data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Failed (${res.status})`);
        }
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 2000);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border-default bg-surface-card px-6 py-4">
        <div className="mx-auto flex max-w-[1100px] items-start justify-between gap-4">
          <div className="flex-1">
            <Link href="/templates" className="text-[10px] uppercase tracking-[0.15em] text-brand-gold hover:underline">
              ← All templates
            </Link>
            <input
              type="text"
              value={data.name}
              onChange={(e) => updateData({ name: e.target.value })}
              disabled={isReadOnly}
              placeholder="Template name"
              className="mt-1 w-full bg-transparent font-display text-2xl font-semibold text-text-primary outline-none placeholder:text-text-muted disabled:opacity-70"
            />
            <input
              type="text"
              value={data.description}
              onChange={(e) => updateData({ description: e.target.value })}
              disabled={isReadOnly}
              placeholder="Short description"
              className="mt-1 w-full bg-transparent text-sm text-text-secondary outline-none placeholder:text-text-muted disabled:opacity-70"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isReadOnly ? (
              <span className="rounded-full bg-info-bg px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-info">
                Read only
              </span>
            ) : (
              <>
                {savedNotice && <span className="text-[11px] text-success">Saved</span>}
                <label className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                  <input
                    type="checkbox"
                    checked={data.isDefault}
                    onChange={(e) => updateData({ isDefault: e.target.checked })}
                  />
                  Default for org
                </label>
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-full bg-brand-gold px-5 py-2 text-xs font-medium tracking-wide text-white transition-colors hover:bg-brand-gold/90 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : mode === 'create' ? 'Create Template' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
        </div>
        {error && (
          <div className="mx-auto mt-2 max-w-[1100px] rounded-md border border-danger/30 bg-danger-bg p-2 text-xs text-danger">
            {error}
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-[1100px] space-y-4">
          {data.sections.map((section, sIdx) => (
            <SectionCard
              key={`${section.id}-${sIdx}`}
              section={section}
              sIdx={sIdx}
              total={data.sections.length}
              isReadOnly={isReadOnly}
              onUpdate={(patch) => updateSection(sIdx, patch)}
              onRemove={() => removeSection(sIdx)}
              onMove={(dir) => moveSection(sIdx, dir)}
              onAddField={() => addField(sIdx)}
              onRemoveField={(fIdx) => removeField(sIdx, fIdx)}
              onMoveField={(fIdx, dir) => moveField(sIdx, fIdx, dir)}
              onUpdateField={(fIdx, patch) => updateField(sIdx, fIdx, patch)}
            />
          ))}

          {!isReadOnly && (
            <button
              onClick={addSection}
              className="w-full rounded-xl border-2 border-dashed border-border-default py-4 text-sm font-medium text-text-muted transition-colors hover:border-brand-gold hover:text-brand-gold"
            >
              + Add Section
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  section,
  sIdx,
  total,
  isReadOnly,
  onUpdate,
  onRemove,
  onMove,
  onAddField,
  onRemoveField,
  onMoveField,
  onUpdateField,
}: {
  section: Section;
  sIdx: number;
  total: number;
  isReadOnly: boolean;
  onUpdate: (patch: Partial<Section>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onAddField: () => void;
  onRemoveField: (fIdx: number) => void;
  onMoveField: (fIdx: number, dir: -1 | 1) => void;
  onUpdateField: (fIdx: number, patch: Partial<Field>) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-xl border border-border-default bg-white">
      {/* Section header */}
      <div className="flex items-start justify-between gap-3 border-b border-border-default px-5 py-3">
        <div className="flex flex-1 items-start gap-2">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="mt-1 text-text-muted hover:text-text-primary"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" className={collapsed ? '-rotate-90' : ''}>
              <path d="M2 3L5 6L8 3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
            </svg>
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">
                Section {section.id}
              </span>
              {section.required && (
                <span className="rounded-full bg-warning-bg px-1.5 py-0.5 text-[8px] font-bold uppercase text-warning">
                  Required
                </span>
              )}
            </div>
            <input
              type="text"
              value={section.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              disabled={isReadOnly}
              className="mt-0.5 w-full bg-transparent font-display text-base font-semibold text-text-primary outline-none disabled:opacity-70"
            />
            {!collapsed && (
              <input
                type="text"
                value={section.desc || ''}
                onChange={(e) => onUpdate({ desc: e.target.value })}
                disabled={isReadOnly}
                placeholder="Section description / instructions for the user"
                className="mt-1 w-full bg-transparent text-xs text-text-muted outline-none disabled:opacity-70"
              />
            )}
          </div>
        </div>
        {!isReadOnly && (
          <div className="flex shrink-0 items-center gap-0.5">
            <label className="mr-2 flex items-center gap-1 text-[10px] text-text-muted">
              <input
                type="checkbox"
                checked={section.required ?? false}
                onChange={(e) => onUpdate({ required: e.target.checked })}
              />
              Required
            </label>
            <button
              onClick={() => onMove(-1)}
              disabled={sIdx === 0}
              className="rounded p-1 text-text-muted hover:bg-surface-page disabled:opacity-30"
              title="Move up"
            >
              ↑
            </button>
            <button
              onClick={() => onMove(1)}
              disabled={sIdx === total - 1}
              className="rounded p-1 text-text-muted hover:bg-surface-page disabled:opacity-30"
              title="Move down"
            >
              ↓
            </button>
            <button
              onClick={onRemove}
              className="rounded p-1 text-danger/70 hover:bg-danger-bg hover:text-danger"
              title="Remove section"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Fields */}
      {!collapsed && (
        <div className="space-y-2 p-5">
          {section.fields.length === 0 && (
            <p className="py-2 text-center text-xs text-text-muted">No fields yet</p>
          )}
          {section.fields.map((field, fIdx) => (
            <FieldRow
              key={`${field.id}-${fIdx}`}
              field={field}
              fIdx={fIdx}
              total={section.fields.length}
              isReadOnly={isReadOnly}
              onUpdate={(patch) => onUpdateField(fIdx, patch)}
              onRemove={() => onRemoveField(fIdx)}
              onMove={(dir) => onMoveField(fIdx, dir)}
            />
          ))}
          {!isReadOnly && (
            <button
              onClick={onAddField}
              className="w-full rounded-md border border-dashed border-border-default py-2 text-xs text-text-muted transition-colors hover:border-brand-gold hover:text-brand-gold"
            >
              + Add Field
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FieldRow({
  field,
  fIdx,
  total,
  isReadOnly,
  onUpdate,
  onRemove,
  onMove,
}: {
  field: Field;
  fIdx: number;
  total: number;
  isReadOnly: boolean;
  onUpdate: (patch: Partial<Field>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-border-default bg-surface-page">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-text-muted"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" className={expanded ? 'rotate-90' : ''}>
            <path d="M2 1.5L5 4L2 6.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          </svg>
        </button>
        <input
          type="text"
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          disabled={isReadOnly}
          className="flex-1 bg-transparent text-xs font-medium text-text-primary outline-none disabled:opacity-70"
        />
        <select
          value={field.type}
          onChange={(e) => onUpdate({ type: e.target.value })}
          disabled={isReadOnly}
          className="rounded border border-border-default bg-white px-2 py-0.5 text-[10px] text-text-secondary disabled:opacity-70"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-[10px] text-text-muted">
          <input
            type="checkbox"
            checked={field.required ?? false}
            onChange={(e) => onUpdate({ required: e.target.checked })}
            disabled={isReadOnly}
          />
          Req
        </label>
        <label className="flex items-center gap-1 text-[10px] text-text-muted">
          <input
            type="checkbox"
            checked={field.ai ?? false}
            onChange={(e) => onUpdate({ ai: e.target.checked })}
            disabled={isReadOnly}
          />
          AI
        </label>
        {!isReadOnly && (
          <div className="flex items-center gap-0.5">
            <button onClick={() => onMove(-1)} disabled={fIdx === 0} className="rounded p-0.5 text-text-muted disabled:opacity-30">↑</button>
            <button onClick={() => onMove(1)} disabled={fIdx === total - 1} className="rounded p-0.5 text-text-muted disabled:opacity-30">↓</button>
            <button onClick={onRemove} className="rounded p-0.5 text-danger/70 hover:text-danger">✕</button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="space-y-2 border-t border-border-default px-3 py-2">
          <div>
            <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-text-muted">Field ID (key)</label>
            <input
              type="text"
              value={field.id}
              onChange={(e) => onUpdate({ id: e.target.value })}
              disabled={isReadOnly}
              className="w-full rounded border border-border-default bg-white px-2 py-1 font-mono text-[11px] disabled:opacity-70"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-text-muted">Help text / instructions</label>
            <input
              type="text"
              value={field.hint || ''}
              onChange={(e) => onUpdate({ hint: e.target.value })}
              disabled={isReadOnly}
              placeholder="Shown to the user under the field label"
              className="w-full rounded border border-border-default bg-white px-2 py-1 text-[11px] disabled:opacity-70"
            />
          </div>
          {field.type === 'textarea' && (
            <div>
              <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-text-muted">Rows</label>
              <input
                type="number"
                min={2}
                max={20}
                value={field.rows ?? 4}
                onChange={(e) => onUpdate({ rows: parseInt(e.target.value, 10) || 4 })}
                disabled={isReadOnly}
                className="w-20 rounded border border-border-default bg-white px-2 py-1 text-[11px] disabled:opacity-70"
              />
            </div>
          )}
          {(field.type === 'select' || field.type === 'radio') && (
            <div>
              <label className="mb-0.5 block text-[10px] uppercase tracking-wider text-text-muted">
                Options (one per line)
              </label>
              <textarea
                value={(field.opts || []).join('\n')}
                onChange={(e) => onUpdate({ opts: e.target.value.split('\n').filter(Boolean) })}
                disabled={isReadOnly}
                rows={3}
                className="w-full rounded border border-border-default bg-white px-2 py-1 text-[11px] disabled:opacity-70"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
