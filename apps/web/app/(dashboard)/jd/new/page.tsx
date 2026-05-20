'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function NewJDPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTitle: '', data: {} }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }
      const jd = await res.json();
      router.push(`/jd/${jd.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create JD');
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-surface-page">
      <div className="w-full max-w-[420px] rounded-xl bg-white p-8 shadow-lg border border-border-default text-center">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold">New Job Description</div>
        <h1 className="font-display text-2xl font-bold text-text-primary mb-2">Start from blank</h1>
        <p className="text-[13px] text-text-secondary mb-6">
          Creates a new draft JD from the default template. You can set the job title and fill each section inside the editor.
        </p>
        {error && (
          <div className="mb-4 rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>
        )}
        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full rounded-md bg-brand-gold px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-40"
        >
          {creating ? 'Creating…' : 'Create new JD'}
        </button>
        <button
          onClick={() => router.back()}
          className="mt-3 w-full rounded-md border border-border-default px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-page"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
