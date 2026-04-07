'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function AnalysePage() {
  const router = useRouter();
  const [tab, setTab] = useState<'text' | 'file' | 'url'>('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setText((ev.target?.result as string) || '');
    reader.readAsText(file, 'UTF-8');
  };

  const handleUrl = async () => {
    if (!url.trim()) return;
    setUrlLoading(true);
    setUrlError('');
    try {
      const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.contents) {
        const plain = data.contents.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (plain.length < 50) {
          setUrlError('Page fetched but no readable text found.');
        } else {
          setText(plain.substring(0, 10000));
        }
      } else {
        setUrlError('Could not fetch content. Please copy and paste the text instead.');
      }
    } catch {
      setUrlError('Could not fetch this URL. Please copy the text and paste it instead.');
    }
    setUrlLoading(false);
  };

  const handleAnalyse = async () => {
    if (text.trim().length < 20) return;
    setLoading(true);
    try {
      // Create a new JD, then analyse
      const createRes = await fetch('/api/jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: {}, jobTitle: 'Analysed JD' }),
      });
      if (!createRes.ok) throw new Error('Failed to create JD');
      const jd = await createRes.json();

      // Run analysis
      const analyseRes = await fetch('/api/ai/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          templateFieldIds: [
            'jobTitle', 'jobCode', 'orgUnit', 'jobFamily', 'jobPurpose', 'positionType',
            'minEducation', 'minExperience', 'keyKnowledge', 'languageReqs', 'responsibilities',
            'problemComplexity', 'planningScope', 'internalStakeholders', 'externalContacts',
            'communicationMode', 'systems', 'physicalSkills', 'peopleManagement', 'budgetAuthority',
            'impactScope', 'workLocation', 'travelReqs', 'workingConditions', 'benchmarkRefs', 'proposedGrade',
          ],
        }),
      });

      if (analyseRes.ok) {
        const result = await analyseRes.json();
        // Update the JD with extracted fields
        await fetch(`/api/jd/${jd.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: result.extractedFields || {},
            jobTitle: result.extractedFields?.jobTitle || 'Analysed JD',
            orgUnit: result.extractedFields?.orgUnit,
          }),
        });
      }

      router.push(`/jd/${jd.id}`);
    } catch {
      setLoading(false);
    }
  };

  const canSubmit = text.trim().length > 20;

  const tabCls = (t: string) =>
    `px-4 py-2 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-brand-gold text-text-primary' : 'border-transparent text-text-muted'}`;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[800px] animate-fade-in">
        <h1 className="mb-1 font-display text-2xl font-bold text-text-primary">JD Analyser — Import Content</h1>
        <p className="mb-2 text-[13px] leading-normal text-text-secondary">
          Upload or paste your existing JD draft for AI analysis, quality assessment, and gap identification.
        </p>

        <div className="mb-6 flex items-center gap-2.5 rounded-lg bg-info-bg p-2.5 text-xs text-info">
          <span className="text-base">ⓘ</span>
          <span>This step is <strong>optional</strong>. You can skip it and start from a blank template.</span>
        </div>

        <div className="rounded-xl border border-border-default bg-white">
          {/* Tabs */}
          <div className="flex border-b border-border-default px-5">
            {[
              { id: 'text' as const, label: '✎ Paste Text' },
              { id: 'file' as const, label: '📄 Upload File' },
              { id: 'url' as const, label: '🔗 Website URL' },
            ].map((t) => (
              <button key={t.id} type="button" className={tabCls(t.id)} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {tab === 'text' && (
              <>
                <label className="mb-1 block text-[11px] font-semibold text-text-primary">
                  Job Description Text <span className="text-brand-gold">*</span>
                </label>
                <p className="mb-2 text-[11px] italic text-text-muted">
                  Paste any JD text, job posting, internal notes, or free-form description.
                </p>
                <textarea
                  value={text} onChange={(e) => setText(e.target.value)}
                  placeholder="Paste your job description here..."
                  className="mb-1.5 w-full resize-y rounded-lg border border-border-default bg-surface-page p-3 font-body text-[13px] leading-[1.7] text-text-primary outline-none"
                  style={{ minHeight: 280 }}
                />
                <div className="text-[11px] text-text-muted">
                  {text.length} characters · {text.split(/\s+/).filter(Boolean).length} words
                </div>
              </>
            )}

            {tab === 'file' && (
              <>
                <p className="mb-4 text-[11px] leading-relaxed text-text-muted">
                  Supported: <strong>.txt, .md, .csv</strong> · <strong>.docx, .pdf</strong> (text extraction)
                </p>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="mb-4 cursor-pointer rounded-lg border-2 border-dashed border-border-default bg-surface-page p-10 text-center transition-colors hover:border-brand-gold"
                >
                  <div className="mb-2.5 text-[32px] opacity-50">📄</div>
                  <div className="font-medium text-text-primary">Drop a file here or click to browse</div>
                  <div className="text-[11px] text-text-muted">.txt .md .docx .pdf .csv .xlsx</div>
                  {fileName && <div className="mt-3 text-xs font-medium text-cat-skills">✓ {fileName} loaded</div>}
                </div>
                <input ref={fileRef} type="file" accept=".txt,.md,.csv,.docx,.doc,.pdf,.xls,.xlsx" className="hidden" onChange={handleFile} />
                {text && (
                  <div>
                    <div className="mb-1 text-[11px] font-semibold text-text-primary">Extracted content preview:</div>
                    <div className="max-h-[140px] overflow-y-auto whitespace-pre-wrap rounded-md bg-surface-page p-2.5 text-[11px] leading-relaxed text-text-secondary">
                      {text.substring(0, 600)}{text.length > 600 ? '...' : ''}
                    </div>
                    <div className="mt-1 text-[10px] text-text-muted">{text.length} characters extracted</div>
                  </div>
                )}
              </>
            )}

            {tab === 'url' && (
              <>
                <p className="mb-3 text-[11px] leading-relaxed text-text-muted">
                  Enter a URL to a job posting. Note: many websites block automated access.
                </p>
                <div className="mb-3 flex gap-2">
                  <input value={url} onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://company.com/careers/job-posting"
                    className="flex-1 rounded-md border border-border-default bg-surface-page px-3 py-2 font-body text-[13px] text-text-primary outline-none" />
                  <button type="button" onClick={handleUrl} disabled={!url.trim() || urlLoading}
                    className="rounded-md bg-cat-skills px-4 py-2 text-xs font-medium text-white disabled:opacity-50">
                    {urlLoading ? 'Fetching...' : 'Fetch'}
                  </button>
                </div>
                {urlError && <div className="mb-2.5 rounded-md bg-danger-bg p-2.5 text-[11px] text-danger">{urlError}</div>}
                {text && !urlError && (
                  <div>
                    <div className="mb-1 text-[11px] font-semibold text-success">✓ Content fetched successfully</div>
                    <div className="max-h-[120px] overflow-y-auto whitespace-pre-wrap rounded-md bg-surface-page p-2.5 text-[11px] text-text-secondary">
                      {text.substring(0, 500)}...
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex items-center justify-between">
          <button type="button" onClick={() => router.push('/jd/new')}
            className="rounded-md border border-border-default px-4 py-2 text-[13px] text-text-secondary">
            Skip — start blank
          </button>
          <div className="flex items-center gap-2">
            {canSubmit && <span className="text-[11px] text-text-muted">{text.split(/\s+/).filter(Boolean).length} words ready</span>}
            <button type="button" onClick={handleAnalyse} disabled={!canSubmit || loading}
              className="rounded-md bg-cat-skills px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40">
              {loading ? 'Analysing...' : '◆ Analyse & Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
