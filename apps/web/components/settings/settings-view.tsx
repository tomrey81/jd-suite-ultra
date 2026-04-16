'use client';

import { useState, useEffect } from 'react';

interface GovSettings {
  anthropicApiKey: string;
  notionToken: string;
  notionParentPageId: string;
  workerUrl: string;
  defaultLanguage: 'EN' | 'PL' | 'ES';
  aiModel: string;
  aiModelFast: string;
}

const DEFAULTS: GovSettings = {
  anthropicApiKey: '',
  notionToken: '',
  notionParentPageId: '3378b054-c583-8157-826a-ce436e4194c7',
  workerUrl: '',
  defaultLanguage: 'EN',
  aiModel: 'claude-opus-4-6',
  aiModelFast: 'claude-haiku-4-5-20251001',
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

function saveSettings(s: GovSettings) {
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

export function SettingsView() {
  const [settings, setSettings] = useState<GovSettings>(DEFAULTS);
  const [saved, setSaved] = useState(false);
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
    saveSettings(settings);
    setSaved(true);
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

  const initNotionDbs = async () => {
    if (!settings.workerUrl || !settings.notionToken || !settings.notionParentPageId) {
      setNotionMsg('All Notion fields are required to initialise databases.');
      setNotionStatus('error');
      return;
    }
    setNotionStatus('testing');
    setNotionMsg('Creating JD Records and JD Versions databases...');
    try {
      // Create JD Records database
      const recordsRes = await fetch(settings.workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'POST',
          path: 'databases',
          token: settings.notionToken,
          body: {
            parent: { type: 'page_id', page_id: settings.notionParentPageId },
            title: [{ type: 'text', text: { content: 'JD Records' } }],
            properties: {
              Title: { title: {} },
              Status: { select: { options: [
                { name: 'Draft', color: 'gray' },
                { name: 'In Review', color: 'yellow' },
                { name: 'Approved', color: 'green' },
                { name: 'Archived', color: 'red' },
              ]}},
              Family: { select: { options: [] } },
              'Score Total': { number: { format: 'number' } },
              'Score Structure': { number: { format: 'number' } },
              'Score Bias': { number: { format: 'number' } },
              'Score EUPTD': { number: { format: 'number' } },
              Language: { select: { options: [
                { name: 'EN', color: 'blue' },
                { name: 'PL', color: 'red' },
                { name: 'ES', color: 'orange' },
              ]}},
              Source: { select: { options: [
                { name: 'Pasted', color: 'gray' },
                { name: 'Uploaded', color: 'blue' },
                { name: 'URL', color: 'purple' },
                { name: 'Blank', color: 'default' },
              ]}},
              'Source URL': { url: {} },
              'Time to First Draft (s)': { number: { format: 'number' } },
              'Time to Approved (s)': { number: { format: 'number' } },
              Iterations: { number: { format: 'number' } },
              'Flags Resolved': { number: { format: 'number' } },
            },
          },
        }),
      });

      if (!recordsRes.ok) {
        const txt = await recordsRes.text();
        throw new Error(`Failed to create JD Records: ${txt.slice(0, 150)}`);
      }

      const recordsDb = await recordsRes.json();

      // Create JD Versions database
      const versionsRes = await fetch(settings.workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'POST',
          path: 'databases',
          token: settings.notionToken,
          body: {
            parent: { type: 'page_id', page_id: settings.notionParentPageId },
            title: [{ type: 'text', text: { content: 'JD Versions' } }],
            properties: {
              Version: { title: {} },
              'JD Record': { relation: { database_id: recordsDb.id, single_property: {} } },
              'Score at Save': { number: { format: 'number' } },
              Action: { select: { options: [
                { name: 'Imported', color: 'gray' },
                { name: 'AI Rewrite', color: 'purple' },
                { name: 'Manual Edit', color: 'blue' },
                { name: 'Approved', color: 'green' },
              ]}},
              Timestamp: { date: {} },
            },
          },
        }),
      });

      if (!versionsRes.ok) {
        const txt = await versionsRes.text();
        throw new Error(`Failed to create JD Versions: ${txt.slice(0, 150)}`);
      }

      const versionsDb = await versionsRes.json();
      setNotionStatus('ok');
      setNotionMsg(`Databases created.\nJD Records: ${recordsDb.id}\nJD Versions: ${versionsDb.id}`);
    } catch (err: any) {
      setNotionStatus('error');
      setNotionMsg(err.message || 'Failed to create databases');
    }
  };

  const inputCls = 'w-full rounded-md border border-border-default bg-surface-page px-3 py-2 font-mono text-xs text-text-primary outline-none focus:border-brand-gold';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border-default bg-surface-card px-6 py-4">
        <h1 className="font-display text-lg text-text-primary">Settings</h1>
        <p className="text-xs text-text-muted">API keys, Notion config, language defaults. Stored in localStorage only, never logged or sent to Quadrance servers.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-8">
          {/* Anthropic API */}
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
              <Field label="Rewrite Model" desc="Used for section rewrites and AI interpretation.">
                <input className={inputCls} value={settings.aiModel} onChange={(e) => update('aiModel', e.target.value)} />
              </Field>
              <Field label="Fast Model" desc="Used for section parsing and quick classification.">
                <input className={inputCls} value={settings.aiModelFast} onChange={(e) => update('aiModelFast', e.target.value)} />
              </Field>
            </div>
          </section>

          {/* Notion */}
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
            <Field label="Parent Page ID" desc="The Notion page under which JD Records and JD Versions databases will be created.">
              <input
                className={inputCls}
                value={settings.notionParentPageId}
                onChange={(e) => update('notionParentPageId', e.target.value)}
              />
            </Field>
            <Field label="Cloudflare Worker URL" desc="The CORS proxy worker URL for Notion API calls.">
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
                {notionStatus === 'testing' ? 'Testing...' : 'Test Notion Connection'}
              </button>
              <button
                onClick={initNotionDbs}
                disabled={notionStatus === 'testing'}
                className="rounded-md border border-brand-gold/40 bg-brand-gold/10 px-4 py-2 text-xs font-semibold text-brand-gold transition-colors hover:bg-brand-gold/20"
              >
                Initialise Notion Databases
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

          {/* Defaults */}
          <section>
            <h2 className="mb-4 text-sm font-semibold text-text-primary">Defaults</h2>
            <Field label="Default Language" desc="JD parsing and bias rule language.">
              <select
                className={inputCls}
                value={settings.defaultLanguage}
                onChange={(e) => update('defaultLanguage', e.target.value)}
              >
                <option value="EN">English</option>
                <option value="PL">Polish</option>
                <option value="ES">Spanish</option>
              </select>
            </Field>
          </section>

          {/* Save */}
          <div className="flex items-center gap-3 border-t border-border-default pt-6">
            <button
              onClick={handleSave}
              className="rounded-md bg-brand-gold px-6 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-brand-gold/90"
            >
              Save Settings
            </button>
            {saved && <span className="text-xs text-success">Saved to localStorage.</span>}
          </div>

          <div className="pb-8 text-[10px] text-text-muted">
            Your JD content is sent to Anthropic and Notion only. Nothing is stored on Quadrance servers.
          </div>
        </div>
      </div>
    </div>
  );
}
