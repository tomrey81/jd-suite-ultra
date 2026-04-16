'use client';

export default function StudioEnsemblePage() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <div className="mb-4 font-display text-2xl text-text-primary">Studio Ensemble</div>
        <div className="text-sm text-text-muted">
          Multi-JD harmonization mode. Select 3-8 JDs from the Library to render simultaneously.
        </div>
        <div className="mt-6 rounded-md border border-border-default bg-surface-card px-6 py-4 text-xs text-text-secondary">
          Available in Gate 4. Engine foundation shipping in Gate 1.
        </div>
      </div>
    </div>
  );
}
