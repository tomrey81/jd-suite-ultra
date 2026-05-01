'use client';

/**
 * Universal export menu for JD Suite.
 *
 * Pass either:
 *   — a `canvasRef` (for visual exports: PNG / JPG / PDF with page format)
 *   — a `data` source (for tabular exports: Word / Excel / CSV / Markdown)
 *   — or both.
 *
 * The menu auto-hides formats that don't apply to what was supplied.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { exportCanvas } from '@/lib/export/canvas-export';
import { exportCsv, exportDocx, exportMarkdown, exportXlsx, type DataColumn } from '@/lib/export/data-export';
import { ALL_FORMATS, type PageFormat, type Orientation } from '@/lib/export/page-format';
import { cn } from '@/lib/utils';

interface ExportMenuProps<T = Record<string, unknown>> {
  /** DOM node ref for canvas exports (PNG/JPG/PDF) */
  canvasRef?: React.RefObject<HTMLElement | null>;
  /** Data + column definitions for tabular exports */
  data?: {
    title: string;
    subtitle?: string;
    rows: T[];
    columns: DataColumn<T>[];
  };
  /** Filename stem (no extension); a timestamp is appended automatically */
  fileName?: string;
  /** Page format options exposed to user (defaults to all) */
  pageFormats?: PageFormat[];
  /** Initial page format (defaults to A4) */
  initialPageFormat?: PageFormat;
  /** Initial orientation (defaults to landscape — better for canvases) */
  initialOrientation?: Orientation;
  /** Background color for canvas exports */
  canvasBackground?: string;
  className?: string;
}

const ICON_BY_FORMAT: Record<string, string> = {
  png: '🖼',  jpg: '📷',  pdf: '📄',  docx: '📝',  xlsx: '📊',  csv: '📋',  md: '📓',
};

export function ExportMenu<T = Record<string, unknown>>(props: ExportMenuProps<T>) {
  const {
    canvasRef,
    data,
    fileName = 'jd-suite-export',
    pageFormats = ALL_FORMATS,
    initialPageFormat = 'A4',
    initialOrientation = 'landscape',
    canvasBackground = '#FAF7F2',
    className,
  } = props;

  const [open, setOpen] = useState(false);
  const [pageFormat, setPageFormat] = useState<PageFormat>(initialPageFormat);
  const [orientation, setOrientation] = useState<Orientation>(initialOrientation);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const hasCanvas = !!canvasRef;
  const hasData = !!data && data.rows.length >= 0;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const exportImg = useCallback(
    async (format: 'png' | 'jpg' | 'pdf') => {
      if (!canvasRef?.current) {
        setError('Canvas not ready — try again.');
        return;
      }
      setBusy(format);
      setError(null);
      try {
        await exportCanvas({
          node: canvasRef.current,
          format,
          pageFormat,
          orientation,
          fileName,
          backgroundColor: canvasBackground,
        });
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Export failed');
      } finally {
        setBusy(null);
      }
    },
    [canvasRef, pageFormat, orientation, fileName, canvasBackground],
  );

  const exportData = useCallback(
    async (format: 'docx' | 'xlsx' | 'csv' | 'md') => {
      if (!data) return;
      setBusy(format);
      setError(null);
      try {
        const opts = {
          title: data.title,
          subtitle: data.subtitle,
          rows: data.rows,
          columns: data.columns,
          fileName,
        };
        if (format === 'docx') await exportDocx(opts);
        else if (format === 'xlsx') await exportXlsx(opts);
        else if (format === 'csv') exportCsv(opts);
        else exportMarkdown(opts);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Export failed');
      } finally {
        setBusy(null);
      }
    },
    [data, fileName],
  );

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Export"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-white px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-brand-gold hover:text-brand-gold"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M6 1.5v6m-2-2l2 2 2-2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 8.5v1.5h8V8.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Export
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[280px] overflow-hidden rounded-lg border border-border-default bg-white shadow-xl"
        >
          {hasCanvas && (
            <div className="border-b border-border-default px-3 py-2.5">
              <div className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-text-muted">
                Page format
              </div>
              <div className="flex flex-wrap gap-1">
                {pageFormats.map((f) => (
                  <button
                    key={f}
                    onClick={() => setPageFormat(f)}
                    className={cn(
                      'rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors',
                      pageFormat === f
                        ? 'border-brand-gold bg-brand-gold-lighter text-brand-gold'
                        : 'border-border-default bg-white text-text-secondary hover:border-brand-gold/50',
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-1">
                <button
                  onClick={() => setOrientation('portrait')}
                  className={cn(
                    'flex-1 rounded-md border px-2 py-0.5 text-[10px] font-medium',
                    orientation === 'portrait'
                      ? 'border-brand-gold bg-brand-gold-lighter text-brand-gold'
                      : 'border-border-default bg-white text-text-secondary',
                  )}
                >
                  ▯ Portrait
                </button>
                <button
                  onClick={() => setOrientation('landscape')}
                  className={cn(
                    'flex-1 rounded-md border px-2 py-0.5 text-[10px] font-medium',
                    orientation === 'landscape'
                      ? 'border-brand-gold bg-brand-gold-lighter text-brand-gold'
                      : 'border-border-default bg-white text-text-secondary',
                  )}
                >
                  ▭ Landscape
                </button>
              </div>
            </div>
          )}

          <div className="py-1">
            {hasCanvas && (
              <>
                <Item busy={busy === 'pdf'} onClick={() => exportImg('pdf')} icon={ICON_BY_FORMAT.pdf} label="PDF" hint={`${pageFormat} ${orientation}`} />
                <Item busy={busy === 'png'} onClick={() => exportImg('png')} icon={ICON_BY_FORMAT.png} label="PNG image" hint="300 DPI" />
                <Item busy={busy === 'jpg'} onClick={() => exportImg('jpg')} icon={ICON_BY_FORMAT.jpg} label="JPG image" hint="300 DPI" />
              </>
            )}
            {hasCanvas && hasData && <div className="my-1 border-t border-border-default" />}
            {hasData && (
              <>
                <Item busy={busy === 'docx'} onClick={() => exportData('docx')} icon={ICON_BY_FORMAT.docx} label="Word (.docx)" hint={`${data!.rows.length} rows`} />
                <Item busy={busy === 'xlsx'} onClick={() => exportData('xlsx')} icon={ICON_BY_FORMAT.xlsx} label="Excel (.xlsx)" hint={`${data!.rows.length} rows`} />
                <Item busy={busy === 'csv'} onClick={() => exportData('csv')} icon={ICON_BY_FORMAT.csv} label="CSV" hint={`${data!.rows.length} rows`} />
                <Item busy={busy === 'md'} onClick={() => exportData('md')} icon={ICON_BY_FORMAT.md} label="Markdown · Notion" hint={`${data!.rows.length} rows`} />
              </>
            )}
          </div>

          {error && (
            <div className="border-t border-danger/30 bg-danger-bg px-3 py-2 text-[10px] text-danger">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Item({ busy, onClick, icon, label, hint }: { busy: boolean; onClick: () => void; icon: string; label: string; hint?: string }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] text-text-primary transition-colors hover:bg-surface-page disabled:opacity-50"
    >
      <span className="w-5 shrink-0 text-center text-[14px] leading-none">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[9px] text-text-muted">{busy ? 'Working…' : hint}</span>}
    </button>
  );
}
