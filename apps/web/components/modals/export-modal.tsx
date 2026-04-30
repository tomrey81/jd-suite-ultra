'use client';

import { useState } from 'react';
import { useJDStore } from '@/hooks/use-jd-store';
import { cn } from '@/lib/utils';

interface FormatDef {
  id: string;
  label: string;
  ext: string;
  icon: string;
  group: 'text' | 'data' | 'visual' | 'audio';
  mode: 'server' | 'print-page' | 'image-page' | 'studio-link';
  description: string;
}

const FORMATS: FormatDef[] = [
  // Text
  { id: 'txt',  label: 'Plain Text',  ext: '.txt',  icon: '📄',  group: 'text',   mode: 'server',       description: 'Full JD as clean text with section headers' },
  { id: 'md',   label: 'Markdown',    ext: '.md',   icon: '⬡',   group: 'text',   mode: 'server',       description: 'Full JD with bold section headings' },
  { id: 'json', label: 'JSON',        ext: '.json', icon: '{ }', group: 'text',   mode: 'server',       description: 'Structured data + evaluation results' },
  { id: 'csv',  label: 'CSV',         ext: '.csv',  icon: '⊞',   group: 'data',   mode: 'server',       description: 'Field → value pairs, Excel-ready' },
  // Data
  { id: 'docx', label: 'Word',        ext: '.docx', icon: 'W',   group: 'data',   mode: 'server',       description: 'Microsoft Word document (.docx)' },
  { id: 'xlsx', label: 'Excel',       ext: '.xlsx', icon: 'X',   group: 'data',   mode: 'server',       description: 'All fields + evaluation in one workbook' },
  // Visual — full Axiomera-style document
  { id: 'pdf',  label: 'PDF',         ext: '.pdf',  icon: '📑',  group: 'visual', mode: 'print-page',   description: 'Full document layout → print to PDF' },
  { id: 'png',  label: 'PNG',         ext: '.png',  icon: '🖼',   group: 'visual', mode: 'image-page',   description: 'Full JD document as high-res PNG image' },
  { id: 'jpg',  label: 'JPG',         ext: '.jpg',  icon: '📷',  group: 'visual', mode: 'image-page',   description: 'Full JD document as compressed JPG' },
  // Audio
  { id: 'wav',  label: 'WAV Audio',   ext: '.wav',  icon: '♫',   group: 'audio',  mode: 'studio-link',  description: 'Sonified JD — open in JD Studio' },
];

const GROUP_LABELS: Record<string, string> = {
  text: 'Text & Documents',
  data: 'Data Formats',
  visual: 'Visual Export — Full Document',
  audio: 'Audio',
};

const GROUP_TIPS: Record<string, string> = {
  visual: 'Exports the complete JD including all sections and evaluation in a clean document layout',
};

export function ExportModal() {
  const { showExport, setShowExport, jdId, jd } = useJDStore();
  const [selected, setSelected] = useState<string>('pdf');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!showExport) return null;

  const fmt = FORMATS.find((f) => f.id === selected)!;
  const hasJd = !!jdId;
  const title = jd.jobTitle || 'Untitled';
  const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);

  const handleDownload = async () => {
    if (!hasJd) return;
    setError(null);

    // ── PDF: open print page in new tab; user prints to PDF ──
    if (fmt.mode === 'print-page') {
      const w = window.open(`/print/${jdId}?auto=1`, '_blank');
      if (!w) setError('Pop-up blocked — please allow pop-ups for this site, then try again.');
      return;
    }

    // ── PNG / JPG: open print page, user clicks "Save as PNG/JPG" ──
    if (fmt.mode === 'image-page') {
      const w = window.open(`/print/${jdId}?format=${fmt.id}`, '_blank');
      if (!w) setError('Pop-up blocked — please allow pop-ups for this site, then try again.');
      return;
    }

    // ── WAV: go to JD Studio ──
    if (fmt.mode === 'studio-link') {
      setShowExport(false);
      window.location.href = `/jd/${jdId}/studio`;
      return;
    }

    // ── Server-side export (TXT, MD, JSON, CSV, DOCX, XLSX) ──
    setLoading(true);
    try {
      const res = await fetch(`/api/jd/${jdId}/export?format=${fmt.id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
        // Handle 501 (package not installed) gracefully
        if (res.status === 501) {
          setError(`${err.error} ${err.hint ?? ''}`);
          return;
        }
        throw new Error(err.error || `Export failed (${res.status})`);
      }

      const blob = await res.blob();
      if (blob.size < 10) throw new Error('Export returned an empty file — please try again.');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `JD_${safeTitle}_${dateStr}${fmt.ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Download failed');
    } finally {
      setLoading(false);
    }
  };

  const groups = ['text', 'data', 'visual', 'audio'] as const;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 p-5">
      <div className="w-full max-w-[620px] rounded-xl bg-white shadow-2xl animate-fade-in overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-border-default p-[20px_24px] bg-surface-page">
          <div>
            <h2 className="mb-[3px] font-display text-xl font-bold text-text-primary">Export JD</h2>
            <p className="text-xs text-text-secondary">
              Complete document · all sections · clean layout · audit trail auto-recorded
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setShowExport(false); setError(null); }}
            className="shrink-0 text-xl leading-none text-text-muted hover:text-text-primary transition-colors"
          >
            ×
          </button>
        </div>

        <div className="p-[20px_24px]">
          {!hasJd && (
            <div className="mb-4 rounded-lg bg-warning-bg px-3.5 py-2.5 text-xs text-warning">
              ⚠ Save the JD first before exporting.
            </div>
          )}

          {/* Format groups */}
          {groups.map((group) => {
            const items = FORMATS.filter((f) => f.group === group);
            return (
              <div key={group} className="mb-5">
                <div className="mb-1 flex items-center gap-2">
                  <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-text-muted">
                    {GROUP_LABELS[group]}
                  </div>
                  {GROUP_TIPS[group] && (
                    <div className="text-[9px] text-text-muted/60 italic">{GROUP_TIPS[group]}</div>
                  )}
                </div>
                <div className={cn('grid gap-2', group === 'audio' ? 'grid-cols-1' : 'grid-cols-3')}>
                  {items.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => { setSelected(f.id); setError(null); }}
                      className={cn(
                        'flex flex-col gap-1 rounded-lg border p-3 text-left transition-all',
                        selected === f.id
                          ? 'border-brand-gold bg-brand-gold-light ring-1 ring-brand-gold/30'
                          : 'border-border-default bg-surface-page hover:border-brand-gold/50 hover:bg-white',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base">{f.icon}</span>
                        <span className="font-mono text-[9px] text-text-muted">{f.ext}</span>
                      </div>
                      <div className="text-[11px] font-semibold text-text-primary">{f.label}</div>
                      <div className="text-[10px] leading-tight text-text-muted">{f.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Selected format hint */}
          <div className="mb-3 rounded-md bg-surface-page border border-border-default px-3 py-2 text-[11px] text-text-secondary">
            {fmt.mode === 'print-page' && (
              <>📑 Opens a clean, document-style preview in a new tab. Use <strong>Ctrl+P / ⌘+P → Save as PDF</strong> to download.</>
            )}
            {fmt.mode === 'image-page' && (
              <>🖼 Opens the full JD document in a new tab. Click <strong>"Save as {fmt.ext.toUpperCase().replace('.', '')}"</strong> to download a complete, high-res image of all sections.</>
            )}
            {fmt.mode === 'studio-link' && (
              <>♫ Redirects to JD Studio where you can preview the sonic fingerprint and export a .wav audio file.</>
            )}
            {fmt.mode === 'server' && (
              <>↓ Downloaded directly from server — full JD content including all sections.</>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2.5 text-xs text-danger">
              <strong>Export error:</strong> {error}
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center justify-between border-t border-border-default pt-4">
            <div className="text-[10px] text-text-muted">
              Exports are recorded in version history
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowExport(false); setError(null); }}
                className="rounded-md border border-border-default px-4 py-1.5 text-xs text-text-secondary hover:bg-surface-page transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!hasJd || loading}
                className="inline-flex items-center gap-2 rounded-md bg-brand-gold px-5 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {loading ? (
                  <>
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Exporting…
                  </>
                ) : (
                  fmt.mode === 'print-page' ? '↗ Open PDF Preview' :
                  fmt.mode === 'image-page' ? '↗ Open Image Preview' :
                  fmt.mode === 'studio-link' ? '♫ Open Studio' :
                  `↓ Download ${fmt.ext}`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
