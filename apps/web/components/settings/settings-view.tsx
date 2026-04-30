'use client';

import { useState, useEffect } from 'react';

interface GovSettings {
  anthropicApiKey: string;
  notionToken: string;
  notionParentPageId: string;
  workerUrl: string;
  defaultLanguage: string;
  interfaceLanguage: string;
  aiModel: string;
  aiModelFast: string;
  bilingualSourceLang: string;
  bilingualTargetLang: string;
  bilingualLayout: 'side-by-side' | 'section-by-section' | 'source-first' | 'target-first';
}

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'pl', label: 'Polski' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'sk', label: 'Slovenčina' },
  { code: 'cs', label: 'Čeština' },
  { code: 'ro', label: 'Română' },
  { code: 'sv', label: 'Svenska' },
];

const JD_LANGUAGES = [
  { code: 'EN', label: 'English' },
  { code: 'PL', label: 'Polish' },
  { code: 'DE', label: 'German' },
  { code: 'FR', label: 'French' },
  { code: 'ES', label: 'Spanish' },
  { code: 'SK', label: 'Slovak' },
  { code: 'CS', label: 'Czech' },
  { code: 'RO', label: 'Romanian' },
  { code: 'SV', label: 'Swedish' },
];

const DEFAULTS: GovSettings = {
  anthropicApiKey: '',
  notionToken: '',
  notionParentPageId: '3378b054-c583-8157-826a-ce436e4194c7',
  workerUrl: '',
  defaultLanguage: 'EN',
  interfaceLanguage: 'en',
  aiModel: 'claude-opus-4-6',
  aiModelFast: 'claude-haiku-4-5-20251001',
  bilingualSourceLang: 'EN',
  bilingualTargetLang: 'PL',
  bilingualLayout: 'side-by-side',
};

const LS_KEY = 'jdgc_settings';

function loadSettings(): GovSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function saveSettingsToLS(s: GovSettings) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

function Field({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-xs font-semibold text-text-primary">{label}</label>
      {desc && <p className="mb-1.5 text-[10px] text-text-muted">{desc}</p>}
      {children}
    </div>
  );
}

type Tab = 'general' | 'integrations' | 'export' | 'ai';

export function SettingsView() {
  const [settings, setSettings] = useState<GovSettings>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [notionStatus, setNotionStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [notionMsg, setNotionMsg] = useState('');

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const update = (key: keyof GovSettings, val: string) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  };

  const handleSave = () => {
    saveSettingsToLS(settings);
    setSaved(true);
    // Apply interface language change
    if (typeof document !== 'undefined') {
      document.cookie = `locale=${settings.interfaceLanguage};path=/;max-age=31536000`;
    }
    setTimeout(() => setSaved(false), 2000);
  };

  const testNotion = async () => {
    if (!settings.workerUrl || !settings.notionToken) {
      setNotionStatus('error');
      setNotionMsg('Worker URL and Notion token are required.');
      return;
    }
    setNotionStatus('testing');
    setNotionMsg('');
    try {
      const res = await fetch(settings.workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'GET',
          path: `pages/${settings.notionParentPageId}`,
          token: settings.notionToken,
        }),
      });
      if (res.ok) {
        setNotionStatus('ok');
        setNotionMsg('Connection successful. Parent page accessible.');
      } else {
        const txt = await res.text();
        setNotionStatus('error');
        setNotionMsg(`HTTP ${res.status}: ${txt.slice(0, 100)}`);
      }
    } catch (err: any) {
      setNotionStatus('error');
      setNotionMsg(err.message || 'Network error');
    }
  };

  const inputCls = 'w-full rounded-md border border-border-default bg-surface-page px-3 py-2 font-mono text-xs text-text-primary outline-none focus:border-brand-gold';

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'general', label: 'General', icon: '⚙' },
    { id: 'integrations', label: 'Integrations', icon: '⊞' },
    { id: 'export', label: 'Export & Translation', icon: '⇄' },
    { id: 'ai', label: 'AI Models', icon: '✦' },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border-default bg-surface-card px-6 py-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-gold">Configuration</div>
        <h1 className="font-display text-xl text-text-primary">Settings</h1>
        <p className="mt-1 text-xs text-text-muted">
          API keys, language, export defaults. Stored in localStorage only.
        </p>
      </div>

      {/* Tabs */}
      <div className="shrink-0 border-b border-border-default bg-surface-card px-6">
        <div className="flex gap-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`border-b-2 px-4 py-2.5 text-[11px] font-medium transition-colors ${
                activeTab === t.id
                  ? 'border-brand-gold text-text-primary'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              <span className="mr-1.5">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-8">

          {/* General Tab */}
          {activeTab === 'general' && (
            <>
              <section>
                <h2 className="mb-4 text-sm font-semibold text-text-primary">Interface Language</h2>
                <Field label="Application language" desc="Changes the interface language across the entire application.">
                  <div className="grid grid-cols-3 gap-2">
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => update('interfaceLanguage', lang.code)}
                        className={`rounded-lg border px-3 py-2.5 text-left text-xs transition-all ${
                          settings.interfaceLanguage === lang.code
                            ? 'border-brand-gold bg-brand-gold/10 text-text-primary'
                            : 'border-border-default bg-white text-text-secondary hover:border-brand-gold/40'
                        }`}
                      >
                        <div className="font-medium">{lang.label}</div>
                        <div className="mt-0.5 text-[9px] uppercase tracking-wider text-text-muted">{lang.code}</div>
                      </button>
                    ))}
                  </div>
                </Field>
              </section>

              <section>
                <h2 className="mb-4 text-sm font-semibold text-text-primary">Default JD Language</h2>
                <Field label="Language for new JDs" desc="Applied to newly created job descriptions. Can be changed per JD.">
                  <select
                    className={inputCls}
                    value={settings.defaultLanguage}
                    onChange={(e) => update('defaultLanguage', e.target.value)}
                  >
                    {JD_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                </Field>
              </section>
            </>
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <>
              <section>
                <h2 className="mb-4 text-sm font-semibold text-text-primary">Notion Integration</h2>
                <Field label="Integration Token" desc="From your Notion integration page. Starts with ntn_ or secret_.">
                  <input
                    type="password"
                    className={inputCls}
                    value={settings.notionToken}
                    onChange={(e) => update('notionToken', e.target.value)}
                    placeholder="ntn_..."
                  />
                </Field>
                <Field label="Parent Page ID" desc="The Notion page under which databases will be created.">
                  <input
                    className={inputCls}
                    value={settings.notionParentPageId}
                    onChange={(e) => update('notionParentPageId', e.target.value)}
                  />
                </Field>
                <Field label="Cloudflare Worker URL" desc="CORS proxy worker URL for Notion API calls.">
                  <input
                    className={inputCls}
                    value={settings.workerUrl}
                    onChange={(e) => update('workerUrl', e.target.value)}
                    placeholder="https://jd-notion-proxy.your-domain.workers.dev"
                  />
                </Field>
                <div className="flex gap-2">
                  <button
                    onClick={testNotion}
                    disabled={notionStatus === 'testing'}
                    className="rounded-md border border-border-default bg-surface-card px-4 py-2 text-xs font-semibold text-text-primary transition-colors hover:border-brand-gold"
                  >
                    {notionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
                {notionMsg && (
                  <div className={`mt-3 whitespace-pre-wrap rounded-md border p-3 font-mono text-[10px] ${
                    notionStatus === 'ok'
                      ? 'border-success/30 bg-success-bg text-success'
                      : notionStatus === 'error'
                        ? 'border-danger/30 bg-danger-bg text-danger'
                        : 'border-border-default bg-surface-page text-text-muted'
                  }`}>
                    {notionMsg}
                  </div>
                )}
              </section>
            </>
          )}

          {/* Export & Translation Tab */}
          {activeTab === 'export' && (
            <>
              <section>
                <h2 className="mb-4 text-sm font-semibold text-text-primary">Bilingual Export Defaults</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Source language" desc="Primary language of the JD.">
                    <select
                      className={inputCls}
                      value={settings.bilingualSourceLang}
                      onChange={(e) => update('bilingualSourceLang', e.target.value)}
                    >
                      {JD_LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>{l.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Target language" desc="Translation language.">
                    <select
                      className={inputCls}
                      value={settings.bilingualTargetLang}
                      onChange={(e) => update('bilingualTargetLang', e.target.value)}
                    >
                      {JD_LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>{l.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Bilingual layout" desc="How source and target languages are arranged in the exported document.">
                  <select
                    className={inputCls}
                    value={settings.bilingualLayout}
                    onChange={(e) => update('bilingualLayout', e.target.value)}
                  >
                    <option value="side-by-side">Side by side (table)</option>
                    <option value="section-by-section">Section by section</option>
                    <option value="source-first">Source first, then translation</option>
                    <option value="target-first">Translation first, then source</option>
                  </select>
                </Field>
              </section>
            </>
          )}

          {/* AI Models Tab */}
          {activeTab === 'ai' && (
            <>
              <section>
                <h2 className="mb-4 text-sm font-semibold text-text-primary">Anthropic API</h2>
                <Field label="API Key" desc="Your personal Anthropic API key. Stored in localStorage only.">
                  <input
                    type="password"
                    className={inputCls}
                    value={settings.anthropicApiKey}
                    onChange={(e) => update('anthropicApiKey', e.target.value)}
                    placeholder="sk-ant-..."
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Primary Model" desc="Used for rewrites and AI interpretation.">
                    <input className={inputCls} value={settings.aiModel} onChange={(e) => update('aiModel', e.target.value)} />
                  </Field>
                  <Field label="Fast Model" desc="Used for parsing and quick classification.">
                    <input className={inputCls} value={settings.aiModelFast} onChange={(e) => update('aiModelFast', e.target.value)} />
                  </Field>
                </div>
              </section>
            </>
          )}

          {/* Save */}
          <div className="flex items-center gap-3 border-t border-border-default pt-6">
            <button
              onClick={handleSave}
              className="rounded-full bg-brand-gold px-6 py-2.5 text-xs font-semibold tracking-wide text-white transition-colors hover:bg-brand-gold/90"
            >
              Save Settings
            </button>
            {saved && <span className="text-xs text-success">Settings saved.</span>}
          </div>

          <div className="pb-8 text-[10px] text-text-muted">
            Settings are stored in your browser. Nothing is sent to our servers.
          </div>
        </div>
      </div>
    </div>
  );
}
