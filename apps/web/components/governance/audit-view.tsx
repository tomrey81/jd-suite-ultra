'use client';

export function AuditView() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border-default bg-surface-card px-6 py-4">
        <h1 className="font-display text-lg text-text-primary">Audit Trail</h1>
        <p className="text-xs text-text-muted">
          Version history, telemetry, provenance, and export. Every action stamped, every version preserved.
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Version Timeline */}
        <div className="w-[320px] shrink-0 overflow-y-auto border-r border-border-default bg-surface-card p-5">
          <div className="mb-4 text-[9px] uppercase tracking-wider text-text-muted">Version History</div>
          <div className="rounded-md border border-border-default bg-surface-page p-4 text-center text-xs text-text-muted">
            Select a JD from the Library to view its audit trail.
          </div>
        </div>

        {/* Right: Details */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Telemetry Card */}
            <div className="rounded-md border border-border-default bg-surface-card p-4">
              <div className="mb-3 text-[9px] uppercase tracking-wider text-text-muted">Telemetry</div>
              <div className="space-y-2">
                {[
                  { label: 'Time to First Draft', value: '--' },
                  { label: 'Time to Approved', value: '--' },
                  { label: 'Iterations', value: '--' },
                  { label: 'Flags Resolved', value: '--' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">{item.label}</span>
                    <span className="font-mono text-text-primary">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Provenance Card */}
            <div className="rounded-md border border-border-default bg-surface-card p-4">
              <div className="mb-3 text-[9px] uppercase tracking-wider text-text-muted">Provenance</div>
              <div className="space-y-2 text-xs text-text-muted">
                <div>Source: --</div>
                <div>Original URL: --</div>
                <div>Created: --</div>
                <div>Last Modified: --</div>
              </div>
            </div>

            {/* Export Card */}
            <div className="col-span-2 rounded-md border border-border-default bg-surface-card p-4">
              <div className="mb-3 text-[9px] uppercase tracking-wider text-text-muted">Export</div>
              <div className="flex flex-wrap gap-2">
                {['Markdown', 'JSON', 'DOCX', 'PDF (with audit trail)', 'MP3 Sonification'].map((fmt) => (
                  <button
                    key={fmt}
                    disabled
                    className="rounded-md border border-border-default bg-surface-page px-3 py-1.5 text-[11px] text-text-muted opacity-50"
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
