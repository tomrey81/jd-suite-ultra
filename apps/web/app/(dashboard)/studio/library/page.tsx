'use client';

export default function StudioLibraryPage() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <div className="mb-4 font-display text-2xl text-text-primary">Sample Packs</div>
        <div className="text-sm text-text-muted">
          Browse and manage sound libraries: Orchestral, Wildlife, Space (NASA), Cinematic, Sci-fi.
        </div>
        <div className="mt-6 rounded-md border border-border-default bg-surface-card px-6 py-4 text-xs text-text-secondary">
          Pack management ships in Gate 3. Engine supports pack switching now.
        </div>
      </div>
    </div>
  );
}
