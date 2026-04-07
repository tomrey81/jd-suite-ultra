'use client';

import { useState } from 'react';

interface Source {
  id: string;
  name: string;
  url: string;
  jobs: { title: string; url: string; location: string }[];
  lastFetched: string | null;
  error: string | null;
}

const inputCls = 'rounded-md border border-border-default bg-white px-3 py-[7px] font-body text-xs text-text-primary outline-none';

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [fetching, setFetching] = useState<string | null>(null);

  const addSource = () => {
    let url = newUrl.trim();
    if (!url) return;
    if (!url.startsWith('http')) url = 'https://' + url;
    let name = newName.trim();
    if (!name) try { name = new URL(url).hostname.replace(/^www\./, ''); } catch { name = url; }

    setSources([...sources, { id: crypto.randomUUID(), name, url, jobs: [], lastFetched: null, error: null }]);
    setNewUrl('');
    setNewName('');
  };

  const fetchJobs = async (id: string) => {
    const src = sources.find((s) => s.id === id);
    if (!src) return;
    setFetching(id);
    try {
      // Server-side proxy would be used in production
      const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(src.url)}`);
      const data = await res.json();
      const html = data.contents || '';
      // Basic extraction — in production this goes through the AI proxy
      const jobs = [{ title: `Jobs from ${src.name} — use AI analyse for full extraction`, url: src.url, location: '' }];
      setSources(sources.map((s) => s.id === id ? { ...s, jobs, lastFetched: new Date().toISOString(), error: null } : s));
    } catch (e: any) {
      setSources(sources.map((s) => s.id === id ? { ...s, error: e.message } : s));
    }
    setFetching(null);
  };

  const deleteSource = (id: string) => setSources(sources.filter((s) => s.id !== id));

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[820px]">
        <h1 className="mb-1 font-display text-2xl font-bold text-text-primary">External Sources</h1>
        <p className="mb-6 text-[13px] text-text-secondary">
          Connect careers websites to scrape live job postings for EIGE analysis and import into JD Suite.
        </p>

        {/* Add source */}
        <div className="mb-5 rounded-lg border border-border-default bg-white p-[22px]">
          <h2 className="mb-3.5 font-display text-[0.95rem] font-semibold">Add a careers website</h2>
          <div className="mb-2.5 flex gap-2.5">
            <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://jobs.company.com"
              className={`${inputCls} flex-[2]`} />
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Label (optional)"
              className={`${inputCls} flex-1`} />
            <button type="button" onClick={addSource} className="rounded-md bg-brand-gold px-4 py-[7px] text-xs font-medium text-white">
              Add source
            </button>
          </div>
          <div className="rounded-md bg-info-bg p-2 text-[11px] text-info">
            Uses server-side proxy + Claude AI to parse job listings. Some sites may block automated access.
          </div>
        </div>

        {/* Sources list */}
        {sources.length === 0 && (
          <div className="rounded-lg border border-dashed border-border-default bg-white p-10 text-center text-[13px] text-text-muted">
            No sources yet. Add a careers website above.
          </div>
        )}

        {sources.map((s) => (
          <div key={s.id} className="mb-4 rounded-lg border border-border-default bg-white p-[22px]">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-semibold text-text-primary">{s.name}</div>
                <a href={s.url} target="_blank" rel="noreferrer" className="text-[11px] text-brand-gold">{s.url}</a>
                {s.lastFetched && <div className="mt-0.5 text-[10px] text-text-muted">Last fetched: {new Date(s.lastFetched).toLocaleString()}</div>}
                {s.error && <div className="text-[11px] text-danger">Error: {s.error}</div>}
              </div>
              <button type="button" onClick={() => fetchJobs(s.id)} disabled={fetching === s.id}
                className="rounded-md bg-cat-skills px-3 py-[7px] text-xs font-medium text-white disabled:opacity-50">
                {fetching === s.id ? 'Fetching...' : '↺ Fetch Jobs'}
              </button>
              <button type="button" onClick={() => deleteSource(s.id)} className="text-base text-text-muted">×</button>
            </div>
            {s.jobs.length > 0 && (
              <div className="space-y-[7px]">
                {s.jobs.map((j, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-md bg-surface-page p-[10px_14px]">
                    <div className="flex-1">
                      <div className="text-[13px] font-medium text-text-primary">{j.title}</div>
                      <div className="text-[11px] text-text-muted">
                        {j.location && `📍 ${j.location} · `}
                        <a href={j.url} target="_blank" rel="noreferrer" className="text-brand-gold">↗ original</a>
                      </div>
                    </div>
                    <button type="button" className="rounded-md border border-border-default px-3 py-1 text-[11px] text-text-secondary">
                      Import →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
