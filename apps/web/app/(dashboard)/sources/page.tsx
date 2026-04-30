'use client';

import { useState } from 'react';
import { HubNav } from '@/components/layout/hub-nav';

interface JobBoardJob {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  posted: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPredicted: boolean;
  contract: string | null;
  category: string | null;
  description: string;
  source: string;
  country: string;
}

interface ScrapedJob {
  title: string;
  location: string;
  department: string;
  url: string;
  snippet: string;
}

const COUNTRIES = [
  { code: 'gb', label: 'United Kingdom' },
  { code: 'us', label: 'United States' },
  { code: 'pl', label: 'Poland' },
  { code: 'de', label: 'Germany' },
  { code: 'fr', label: 'France' },
  { code: 'nl', label: 'Netherlands' },
  { code: 'it', label: 'Italy' },
  { code: 'ca', label: 'Canada' },
  { code: 'au', label: 'Australia' },
  { code: 'in', label: 'India' },
  { code: 'br', label: 'Brazil' },
  { code: 'mx', label: 'Mexico' },
  { code: 'sg', label: 'Singapore' },
  { code: 'za', label: 'South Africa' },
];

const ADZUNA_CATEGORIES = [
  '', 'hr-jobs', 'it-jobs', 'engineering-jobs', 'sales-jobs', 'accounting-finance-jobs',
  'consultancy-jobs', 'marketing-jobs', 'pr-advertising-marketing-jobs', 'admin-jobs',
  'manufacturing-jobs', 'healthcare-nursing-jobs', 'legal-jobs', 'logistics-warehouse-jobs',
  'retail-jobs', 'scientific-qa-jobs', 'teaching-jobs',
];

const inputCls =
  'rounded-md border border-border-default bg-white px-3 py-[7px] font-body text-xs text-text-primary outline-none';

export default function SourcesPage() {
  const [tab, setTab] = useState<'board' | 'scrape'>('board');

  // Adzuna search state
  const [country, setCountry] = useState('gb');
  const [query, setQuery] = useState('');
  const [where, setWhere] = useState('');
  const [category, setCategory] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [fullTime, setFullTime] = useState(false);
  const [page, setPage] = useState(1);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobBoardJob[]>([]);
  const [total, setTotal] = useState(0);

  // Scrape state
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [pastedHtml, setPastedHtml] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapeHint, setScrapeHint] = useState<string | null>(null);
  const [showPasteFallback, setShowPasteFallback] = useState(false);
  const [scrapedJobs, setScrapedJobs] = useState<ScrapedJob[]>([]);
  const [scrapeNotes, setScrapeNotes] = useState<string>('');
  const [scrapeSiteType, setScrapeSiteType] = useState<string>('');

  // Save-full-JD state — keyed by URL so multiple rows can save in parallel feedback
  const [savingFullJD, setSavingFullJD] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
  const [savedJDIds, setSavedJDIds] = useState<Record<string, string>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  async function saveFullJD(opts: { url: string; jobTitleHint?: string; companyHint?: string }) {
    const { url, jobTitleHint, companyHint } = opts;
    if (!url) return;
    setSavingFullJD((s) => ({ ...s, [url]: 'saving' }));
    setSaveErrors((s) => { const n = { ...s }; delete n[url]; return n; });
    try {
      const res = await fetch('/api/jobs/scrape-full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, jobTitleHint, companyHint, sourceUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed (${res.status})`);
      }
      setSavingFullJD((s) => ({ ...s, [url]: 'saved' }));
      setSavedJDIds((s) => ({ ...s, [url]: data.jdId }));
    } catch (err: any) {
      setSavingFullJD((s) => ({ ...s, [url]: 'error' }));
      setSaveErrors((s) => ({ ...s, [url]: err.message || 'Save failed' }));
    }
  }

  async function runSearch(p = 1) {
    if (!query.trim() && !where.trim()) {
      setSearchError('Enter a role/keyword or location to search.');
      return;
    }
    setSearching(true); setSearchError(null); setSearchHint(null);
    try {
      const params = new URLSearchParams({
        country, page: String(p),
        ...(query ? { query } : {}),
        ...(where ? { where } : {}),
        ...(category ? { category } : {}),
        ...(salaryMin ? { salaryMin } : {}),
        ...(fullTime ? { fullTime: '1' } : {}),
      });
      const res = await fetch(`/api/jobs/search?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error || `Search failed (${res.status})`);
        if (data.hint) setSearchHint(data.hint);
        setJobs([]); setTotal(0);
        return;
      }
      setJobs(data.jobs || []);
      setTotal(data.total || 0);
      setPage(p);
    } finally {
      setSearching(false);
    }
  }

  async function runScrape(opts: { useHtml?: boolean } = {}) {
    setScraping(true); setScrapeError(null); setScrapeHint(null); setScrapedJobs([]); setScrapeNotes(''); setScrapeSiteType('');
    try {
      const body = opts.useHtml
        ? { url: scrapeUrl, htmlOverride: pastedHtml }
        : { url: scrapeUrl };
      const res = await fetch('/api/jobs/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setScrapeError(data.error || `Scrape failed (${res.status})`);
        if (data.hint) setScrapeHint(data.hint);
        if (data.canRetryWithPaste) setShowPasteFallback(true);
        return;
      }
      setScrapedJobs(data.jobs || []);
      setScrapeNotes(data.notes || '');
      setScrapeSiteType(data.siteType || '');
      setShowPasteFallback(false);
    } finally {
      setScraping(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[1000px]">
        <HubNav />
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold">
          JD Hub · Live Openings
        </div>
        <h1 className="mb-1 font-display text-2xl font-bold text-text-primary">Live Job Openings</h1>
        <p className="mb-5 text-[13px] text-text-secondary">
          Search live job markets via Adzuna (UK, US, EU, more), or scrape a specific careers page. Save the
          full JD body to JD Hub in one click — folder is auto-named with today&apos;s date.
        </p>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 border-b border-border-default">
          {(['board', 'scrape'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-3 py-2 text-xs font-medium transition-colors ${tab === t ? 'border-brand-gold text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}>
              {t === 'board' ? '🌐 Job board (Adzuna)' : '🎯 Scrape a careers page'}
            </button>
          ))}
        </div>

        {/* ── TAB: Adzuna ───────────────────────────────────────────────── */}
        {tab === 'board' && (
          <div>
            <div className="mb-4 rounded-lg border border-border-default bg-white p-[18px]">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Country</span>
                  <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls}>
                    {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Department / category</span>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                    {ADZUNA_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c ? c.replace('-jobs', '').replace(/-/g, ' ') : 'All categories'}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Role / keyword</span>
                  <input value={query} onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch(1)}
                    placeholder='e.g. "compensation manager" OR "total rewards"'
                    className={inputCls} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Location (optional)</span>
                  <input value={where} onChange={(e) => setWhere(e.target.value)}
                    placeholder="e.g. London, Berlin, Warsaw"
                    className={inputCls} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Min salary (optional)</span>
                  <input type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)}
                    placeholder="e.g. 80000" className={inputCls} />
                </label>
                <label className="flex items-center gap-2 sm:col-span-2">
                  <input type="checkbox" checked={fullTime} onChange={(e) => setFullTime(e.target.checked)} />
                  <span className="text-[12px] text-text-secondary">Full-time only</span>
                </label>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-[11px] text-text-muted">
                  {total > 0 && <>Showing {jobs.length} of ~{total.toLocaleString()} matches{page > 1 && ` · page ${page}`}</>}
                </div>
                <div className="flex gap-2">
                  {page > 1 && (
                    <button type="button" onClick={() => runSearch(page - 1)} disabled={searching}
                      className="rounded border border-border-default px-3 py-1 text-[11px]">← Prev</button>
                  )}
                  <button type="button" onClick={() => runSearch(1)} disabled={searching}
                    className="rounded-md bg-brand-gold px-4 py-[7px] text-xs font-medium text-white disabled:opacity-50">
                    {searching ? 'Searching…' : '🔍 Search'}
                  </button>
                  {jobs.length > 0 && (
                    <button type="button" onClick={() => runSearch(page + 1)} disabled={searching}
                      className="rounded border border-border-default px-3 py-1 text-[11px]">Next →</button>
                  )}
                </div>
              </div>
              {searchError && (
                <div className="mt-3 rounded border border-danger bg-danger-bg p-2 text-[11px] text-danger">
                  {searchError}
                  {searchHint && <div className="mt-1 text-[10px] text-text-muted">{searchHint}</div>}
                </div>
              )}
            </div>

            {jobs.length === 0 && !searching && !searchError && (
              <div className="rounded-lg border border-dashed border-border-default bg-white p-10 text-center text-[13px] text-text-muted">
                Run a search to see live openings.
              </div>
            )}

            <div className="space-y-2">
              {jobs.map((j) => {
                const saveStatus = savingFullJD[j.url];
                const savedId = savedJDIds[j.url];
                const saveErr = saveErrors[j.url];
                return (
                  <div key={j.id} className="rounded-lg border border-border-default bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <a href={j.url} target="_blank" rel="noreferrer"
                          className="text-[14px] font-medium text-text-primary hover:text-brand-gold">{j.title}</a>
                        <div className="mt-0.5 text-[11px] text-text-muted">
                          {j.company && <strong>{j.company}</strong>}
                          {j.company && j.location && ' · '}
                          {j.location && <>📍 {j.location}</>}
                          {j.contract && ` · ${j.contract}`}
                          {j.category && ` · ${j.category}`}
                        </div>
                        {j.description && (
                          <div className="mt-2 text-[11px] leading-relaxed text-text-secondary line-clamp-3">{j.description}</div>
                        )}
                      </div>
                      <div className="text-right text-[11px] text-text-muted">
                        {j.salaryMin && (
                          <div className={`font-semibold ${j.salaryPredicted ? 'text-text-muted' : 'text-text-primary'}`}>
                            {j.salaryMin.toLocaleString()}{j.salaryMax ? ` – ${j.salaryMax.toLocaleString()}` : '+'}
                            {j.salaryPredicted && <div className="text-[9px] italic">predicted</div>}
                          </div>
                        )}
                        <div className="mt-1">{new Date(j.posted).toISOString().slice(0, 10)}</div>
                        <div className="mt-0.5 uppercase text-[9px] text-brand-gold">{j.country}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 border-t border-border-default pt-2.5">
                      {saveStatus === 'saved' && savedId ? (
                        <a
                          href={`/jd/${savedId}`}
                          className="rounded-full bg-success px-3 py-1 text-[10px] font-medium text-white hover:opacity-90"
                        >
                          ✓ Saved to JD Hub — Open
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => saveFullJD({ url: j.url, jobTitleHint: j.title, companyHint: j.company })}
                          disabled={saveStatus === 'saving'}
                          className="rounded-full border border-brand-gold/40 bg-brand-gold/10 px-3 py-1 text-[10px] font-medium text-brand-gold hover:bg-brand-gold/20 disabled:opacity-50"
                        >
                          {saveStatus === 'saving' ? 'Saving full JD…' : '↓ Save full JD to Hub'}
                        </button>
                      )}
                      <span className="text-[9px] text-text-muted">
                        Folder: <code className="rounded bg-surface-page px-1">Scraped JDs {new Date().toISOString().slice(0, 10)}</code>
                      </span>
                      {saveErr && <span className="text-[10px] text-danger">· {saveErr}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB: Scrape ──────────────────────────────────────────────── */}
        {tab === 'scrape' && (
          <div>
            <div className="mb-4 rounded-lg border border-border-default bg-white p-[18px]">
              <label className="mb-2 flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Careers page URL</span>
                <input value={scrapeUrl} onChange={(e) => setScrapeUrl(e.target.value)}
                  placeholder="https://jobs.company.com or https://www.pracuj.pl/praca/..."
                  className={inputCls} />
              </label>

              <div className="mb-3 rounded bg-info-bg p-2 text-[11px] leading-relaxed text-info">
                <strong>What works:</strong> simple HTML careers pages, pracuj.pl listings, most corporate
                Greenhouse/Lever pages. <strong>What doesn&apos;t:</strong> LinkedIn (hard ban),
                Workday/Taleo (JS-rendered), Cloudflare-fronted sites. When blocked, paste HTML manually below.
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => runScrape()} disabled={scraping || !scrapeUrl.trim()}
                  className="rounded-md bg-brand-gold px-4 py-[7px] text-xs font-medium text-white disabled:opacity-50">
                  {scraping ? 'Fetching + AI extracting…' : '↓ Fetch & extract'}
                </button>
                <button type="button" onClick={() => setShowPasteFallback(!showPasteFallback)}
                  className="rounded border border-border-default px-3 py-1.5 text-[11px] text-text-muted">
                  {showPasteFallback ? 'Hide HTML paste' : '📋 Paste HTML instead'}
                </button>
              </div>

              {showPasteFallback && (
                <div className="mt-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Paste HTML source</span>
                    <textarea value={pastedHtml} onChange={(e) => setPastedHtml(e.target.value)}
                      placeholder='In your browser: View Source (Cmd+Opt+U) → Cmd+A → Cmd+C → paste here'
                      rows={5} className={`${inputCls} resize-y font-mono`} />
                  </label>
                  <button type="button" onClick={() => runScrape({ useHtml: true })}
                    disabled={scraping || !pastedHtml.trim()}
                    className="mt-2 rounded-md bg-text-primary px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50">
                    {scraping ? 'Extracting…' : 'Extract from pasted HTML'}
                  </button>
                </div>
              )}

              {scrapeError && (
                <div className="mt-3 rounded border border-danger bg-danger-bg p-2 text-[11px] text-danger">
                  {scrapeError}
                  {scrapeHint && <div className="mt-1 text-[10px] text-text-muted">{scrapeHint}</div>}
                </div>
              )}
            </div>

            {scrapedJobs.length > 0 && (
              <>
                <div className="mb-2 text-[11px] text-text-muted">
                  {scrapeSiteType && <strong>{scrapeSiteType}</strong>}
                  {scrapeSiteType && scrapeNotes && ' · '}
                  {scrapeNotes && <em>{scrapeNotes}</em>}
                </div>
                <div className="space-y-2">
                  {scrapedJobs.map((j, i) => {
                    const saveStatus = j.url ? savingFullJD[j.url] : undefined;
                    const savedId = j.url ? savedJDIds[j.url] : undefined;
                    const saveErr = j.url ? saveErrors[j.url] : undefined;
                    return (
                      <div key={i} className="rounded-lg border border-border-default bg-white p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            {j.url ? (
                              <a href={j.url} target="_blank" rel="noreferrer"
                                className="text-[14px] font-medium text-text-primary hover:text-brand-gold">{j.title}</a>
                            ) : (
                              <div className="text-[14px] font-medium text-text-primary">{j.title}</div>
                            )}
                            <div className="mt-0.5 text-[11px] text-text-muted">
                              {j.location && <>📍 {j.location}</>}
                              {j.location && j.department && ' · '}
                              {j.department && <strong>{j.department}</strong>}
                            </div>
                            {j.snippet && (
                              <div className="mt-1.5 text-[11px] leading-relaxed text-text-secondary">{j.snippet}</div>
                            )}
                          </div>
                        </div>
                        {j.url && (
                          <div className="mt-3 flex items-center gap-2 border-t border-border-default pt-2.5">
                            {saveStatus === 'saved' && savedId ? (
                              <a
                                href={`/jd/${savedId}`}
                                className="rounded-full bg-success px-3 py-1 text-[10px] font-medium text-white hover:opacity-90"
                              >
                                ✓ Saved to JD Hub — Open
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={() => saveFullJD({ url: j.url, jobTitleHint: j.title, companyHint: j.department })}
                                disabled={saveStatus === 'saving'}
                                className="rounded-full border border-brand-gold/40 bg-brand-gold/10 px-3 py-1 text-[10px] font-medium text-brand-gold hover:bg-brand-gold/20 disabled:opacity-50"
                              >
                                {saveStatus === 'saving' ? 'Fetching full JD + extracting…' : '↓ Save full JD to Hub'}
                              </button>
                            )}
                            <span className="text-[9px] text-text-muted">
                              Folder: <code className="rounded bg-surface-page px-1">Scraped JDs {new Date().toISOString().slice(0, 10)}</code>
                            </span>
                            {saveErr && <span className="text-[10px] text-danger">· {saveErr}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
