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
  mode: 'server' | 'client-print' | 'client-image' | 'client-wav' | 'studio-link';
  description: string;
}

const FORMATS: FormatDef[] = [
  // Text
  { id: 'txt',  label: 'Plain Text', ext: '.txt',  icon: '📄', group: 'text',   mode: 'server',       description: 'Clean text with section headers' },
  { id: 'md',   label: 'Markdown',   ext: '.md',   icon: '⬡',  group: 'text',   mode: 'server',       description: 'Markdown with bold headers' },
  { id: 'json', label: 'JSON',       ext: '.json', icon: '{ }', group: 'text',  mode: 'server',       description: 'Structured data + eval results' },
  { id: 'csv',  label: 'CSV',        ext: '.csv',  icon: '⊞',  group: 'data',   mode: 'server',       description: 'Field → value pairs, spreadsheet-ready' },
  // Data
  { id: 'docx', label: 'Word',       ext: '.docx', icon: 'W',  group: 'data',   mode: 'server',       description: 'Microsoft Word document' },
  { id: 'xlsx', label: 'Excel',      ext: '.xlsx', icon: 'X',  group: 'data',   mode: 'server',       description: 'Two sheets: JD + Evaluation' },
  // Visual
  { id: 'pdf',  label: 'PDF',        ext: '.pdf',  icon: '📑',  group: 'visual', mode: 'client-print', description: 'Print-quality PDF via browser' },
  { id: 'png',  label: 'PNG',        ext: '.png',  icon: '🖼',  group: 'visual', mode: 'client-image', description: 'Image snapshot of the JD card' },
  { id: 'jpg',  label: 'JPG',        ext: '.jpg',  icon: '📷',  group: 'visual', mode: 'client-image', description: 'Compressed image of the JD card' },
  // Audio
  { id: 'wav',  label: 'WAV Audio',  ext: '.wav',  icon: '♫',  group: 'audio',  mode: 'studio-link',  description: 'Sonified JD — open in JD Studio' },
];

const GROUP_LABELS: Record<string, string> = {
  text: 'Text & Documents',
  data: 'Data Formats',
  visual: 'Visual',
  audio: 'Audio',
};

export function ExportModal() {
  const { showExport, setShowExport, jdId, jd } = useJDStore();
  const [selected, setSelected] = useState<string>('txt');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!showExport) return null;

  const fmt = FORMATS.find((f) => f.id === selected)!;
  const hasJd = !!jdId;
  const title = jd.jobTitle || 'Untitled';

  const handleDownload = async () => {
    if (!hasJd) return;
    setError(null);

    // Client-side handlers
    if (fmt.mode === 'client-print') {
      window.print();
      return;
    }

    if (fmt.mode === 'studio-link') {
      setShowExport(false);
      window.location.href = `/jd/${jdId}/studio`;
      return;
    }

    if (fmt.mode === 'client-image') {
      await exportAsImage(fmt.id as 'png' | 'jpg', title);
      return;
    }

    // Server-side export
    setLoading(true);
    try {
      const res = await fetch(`/api/jd/${jdId}/export?format=${fmt.id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
        throw new Error(err.error || `Export failed: ${res.status}`);
      }

      const blob = await res.blob();
      // Verify we got actual content
      if (blob.size < 10) throw new Error('Export returned empty file — try again');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
      const date = new Date().toISOString().slice(0, 10);
      a.download = `JD_${safeTitle}_${date}${fmt.ext}`;
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
      <div className="w-full max-w-[600px] rounded-xl bg-white shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border-default p-[20px_24px]">
          <div>
            <h2 className="mb-[3px] font-display text-xl font-bold text-text-primary">Export JD</h2>
            <p className="text-xs text-text-secondary">
              Choose a format — audit trail is recorded automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setShowExport(false); setError(null); }}
            className="shrink-0 text-xl leading-none text-text-muted hover:text-text-primary"
          >
            ×
          </button>
        </div>

        <div className="p-[20px_24px]">
          {!hasJd && (
            <div className="mb-4 rounded-lg bg-warning-bg px-3.5 py-2.5 text-xs text-warning">
              Save the JD first before exporting.
            </div>
          )}

          {/* Format groups */}
          {groups.map((group) => {
            const items = FORMATS.filter((f) => f.group === group);
            return (
              <div key={group} className="mb-4">
                <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.14em] text-text-muted">
                  {GROUP_LABELS[group]}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {items.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => { setSelected(f.id); setError(null); }}
                      className={cn(
                        'flex flex-col gap-1 rounded-lg border p-3 text-left transition-all',
                        selected === f.id
                          ? 'border-brand-gold bg-brand-gold-light'
                          : 'border-border-default bg-surface-page hover:border-brand-gold/50',
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

          {/* Error */}
          {error && (
            <div className="mb-3 rounded-md border border-danger bg-danger-bg px-3 py-2 text-xs text-danger">
              {error}
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center justify-between border-t border-border-default pt-4">
            <div className="text-[11px] text-text-muted">
              {fmt.mode === 'client-print' && 'Opens browser print dialog'}
              {fmt.mode === 'studio-link' && 'Opens JD Studio for sonification export'}
              {fmt.mode === 'client-image' && 'Renders JD card as image'}
              {fmt.mode === 'server' && 'Downloaded from server'}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowExport(false); setError(null); }}
                className="rounded-md border border-border-default px-4 py-1.5 text-xs text-text-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!hasJd || loading}
                className="inline-flex items-center gap-2 rounded-md bg-brand-gold px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              >
                {loading ? (
                  <><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />Exporting…</>
                ) : `↓ Download ${fmt.ext}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function exportAsImage(format: 'png' | 'jpg', title: string) {
  // Find the JD form element and snapshot it to canvas
  const target = document.querySelector('[data-export-target="jd-form"]') as HTMLElement | null;
  if (!target) {
    alert('Could not find JD content to capture. Make sure a section is visible.');
    return;
  }

  try {
    // Dynamic import so html-to-image only loads when needed
    const { toPng, toJpeg } = await import('html-to-image').catch(() => {
      throw new Error('Image export library not available — install html-to-image');
    });

    const dataUrl = format === 'jpg'
      ? await toJpeg(target, { quality: 0.92, backgroundColor: '#F6F4EF' })
      : await toPng(target, { backgroundColor: '#F6F4EF' });

    const a = document.createElement('a');
    a.href = dataUrl;
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `JD_${safeTitle}_${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err: any) {
    alert(err.message || 'Image export failed');
  }
}
