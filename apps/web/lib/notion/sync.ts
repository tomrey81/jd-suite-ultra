/**
 * Notion sync helper.
 * Pushes JD + lint result into configured JD Records / Versions databases
 * via the Cloudflare Worker CORS proxy.
 *
 * All calls go through the user's configured workerUrl + notionToken,
 * which are stored client-side (localStorage) — this module is called
 * from the browser; server-side we only validate shape.
 */

export interface NotionSyncPayload {
  workerUrl: string;
  token: string;
  recordsDbId: string;       // JD Records DB
  versionsDbId: string;      // JD Versions DB
  jobTitle: string;
  bodyText: string;
  score: number;
  structure: number;
  bias: number;
  euptd: number;
  grade: string;
  findingsJson: string;      // stringified
  modelUsed?: string;
}

export interface NotionSyncResult {
  ok: boolean;
  recordId?: string;
  versionId?: string;
  error?: string;
}

const NOTION_VERSION = '2022-06-28';

async function call(workerUrl: string, method: string, path: string, body: unknown, token: string) {
  const res = await fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, path, body, token, notionVersion: NOTION_VERSION }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Notion proxy ${res.status}`);
  return data;
}

export async function syncToNotion(p: NotionSyncPayload): Promise<NotionSyncResult> {
  if (!p.workerUrl || !p.token) return { ok: false, error: 'workerUrl and token are required' };
  if (!p.recordsDbId || !p.versionsDbId) return { ok: false, error: 'recordsDbId and versionsDbId required' };

  try {
    // 1. Create / update JD Record (title + current score)
    const record = await call(p.workerUrl, 'POST', 'pages', {
      parent: { database_id: p.recordsDbId },
      properties: {
        Name:      { title: [{ text: { content: p.jobTitle || 'Untitled JD' } }] },
        Score:     { number: p.score },
        Grade:     { rich_text: [{ text: { content: p.grade } }] },
        Structure: { number: p.structure },
        Bias:      { number: p.bias },
        EUPTD:     { number: p.euptd },
        Model:     { rich_text: [{ text: { content: p.modelUsed || 'manual' } }] },
      },
    }, p.token);

    // 2. Create Version entry with full body snapshot + findings
    const truncBody     = p.bodyText.slice(0, 1800);
    const truncFindings = p.findingsJson.slice(0, 1800);

    const version = await call(p.workerUrl, 'POST', 'pages', {
      parent: { database_id: p.versionsDbId },
      properties: {
        Name:      { title: [{ text: { content: `${p.jobTitle} · ${new Date().toISOString().slice(0, 16)}` } }] },
        Record:    { relation: [{ id: record.id }] },
        Score:     { number: p.score },
        Body:      { rich_text: [{ text: { content: truncBody } }] },
        Findings:  { rich_text: [{ text: { content: truncFindings } }] },
        Timestamp: { date: { start: new Date().toISOString() } },
      },
    }, p.token);

    return { ok: true, recordId: record.id, versionId: version.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'notion sync failed' };
  }
}
