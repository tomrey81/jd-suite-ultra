'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

interface Facets {
  families: Array<{ id: string; name: string; color: string; count: number }>;
  functions: Array<{ name: string; count: number }>;
  levels: Array<{ level: number; count: number }>;
  statuses: Array<{ status: string; count: number }>;
}

interface Current {
  family: string;
  fn: string;
  level: string;
  status: string;
  q: string;
}

export default function LibraryFilters({
  facets,
  current,
}: {
  facets: Facets;
  current: Current;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(sp.toString());
    if (value === null || value === '') params.delete(key);
    else params.set(key, value);
    startTransition(() => {
      router.push(`/v5/library?${params.toString()}`);
    });
  }

  function clearAll() {
    startTransition(() => router.push('/v5/library'));
  }

  const anyActive = current.family || current.fn || current.level || current.status || current.q;

  return (
    <aside className="space-y-3">
      <div className="rounded-lg border border-[#E0DBD4] bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#8A7560]">
            Search
          </div>
          {anyActive ? (
            <button
              onClick={clearAll}
              className="text-[10px] text-[#8A7560] hover:underline"
              disabled={pending}
            >
              Clear all
            </button>
          ) : null}
        </div>
        <input
          defaultValue={current.q}
          placeholder="Title, code, unit…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') setParam('q', (e.target as HTMLInputElement).value.trim());
          }}
          className="w-full rounded border border-[#E0DBD4] bg-[#FAF7F2] px-2 py-1.5 text-[12px] outline-none focus:border-[#8A7560]"
        />
      </div>

      <FacetGroup label="Family">
        {facets.families.length === 0 && (
          <div className="text-[10px] italic text-[#55524A]">No families defined.</div>
        )}
        {facets.families.map((f) => (
          <FacetButton
            key={f.id}
            active={current.family === f.id}
            onClick={() => setParam('family', current.family === f.id ? null : f.id)}
            disabled={pending}
            colorDot={f.color}
            label={f.name}
            count={f.count}
          />
        ))}
      </FacetGroup>

      <FacetGroup label="Level (architecture)">
        {facets.levels.length === 0 && (
          <div className="text-[10px] italic text-[#55524A]">No JDs placed in architecture yet.</div>
        )}
        {facets.levels.map(({ level, count }) => (
          <FacetButton
            key={level}
            active={current.level === String(level)}
            onClick={() => setParam('level', current.level === String(level) ? null : String(level))}
            disabled={pending}
            label={`Level ${level || '—'}`}
            count={count}
          />
        ))}
      </FacetGroup>

      <FacetGroup label="Function (org unit)">
        {facets.functions.length === 0 && (
          <div className="text-[10px] italic text-[#55524A]">No org units recorded.</div>
        )}
        {facets.functions.map(({ name, count }) => (
          <FacetButton
            key={name}
            active={current.fn === name}
            onClick={() => setParam('fn', current.fn === name ? null : name)}
            disabled={pending}
            label={name}
            count={count}
          />
        ))}
      </FacetGroup>

      <FacetGroup label="Status">
        {facets.statuses.map(({ status, count }) => (
          <FacetButton
            key={status}
            active={current.status === status}
            onClick={() => setParam('status', current.status === status ? null : status)}
            disabled={pending}
            label={status}
            count={count}
          />
        ))}
      </FacetGroup>
    </aside>
  );
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#E0DBD4] bg-white p-3">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#8A7560]">
        {label}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function FacetButton({
  active,
  onClick,
  disabled,
  colorDot,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  colorDot?: string;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-between rounded px-2 py-1 text-[11px] transition ${
        active
          ? 'bg-[#1A1A1A] text-white'
          : 'text-[#1A1A1A] hover:bg-[#FAF7F2]'
      } disabled:opacity-50`}
    >
      <span className="flex items-center gap-1.5 truncate">
        {colorDot && (
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorDot }} />
        )}
        <span className="truncate">{label}</span>
      </span>
      <span className={`text-[9px] ${active ? 'text-white' : 'text-[#55524A]'}`}>{count}</span>
    </button>
  );
}
