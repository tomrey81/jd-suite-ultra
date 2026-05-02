/**
 * POST /api/pmoa/scrape-org
 *
 * Fetches the corporate website (main page + common sub-paths like /team,
 * /about, /leadership) and asks Claude to extract departments and positions.
 * Creates PmoaDepartment + PmoaPosition records in the DB for this org,
 * marking them as sourced from the website scrape so they can be reviewed.
 *
 * DOES NOT wipe existing data — new records are additive.
 * Duplicate positions (same name) are skipped to avoid clobbering manual edits.
 *
 * Body: { url: string }
 * Returns: { departments: number; positions: number; skipped: number; url: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@jd-suite/db';
import { requireOrgScope, isScopeError } from '@/lib/pmoa/auth-scope';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({ url: z.string().url().max(2048) });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Sub-paths commonly used for team/leadership/org pages
const ORG_SUB_PATHS = ['/about', '/about-us', '/team', '/our-team', '/leadership', '/management', '/people', '/company'];

function extractText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);
}

async function tryFetch(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JDSuiteBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return '';
    return extractText(await res.text());
  } catch {
    return '';
  }
}

export async function POST(req: NextRequest) {
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Provide a valid URL' }, { status: 400 });
  }

  const { url } = parsed.data;
  const base = new URL(url).origin;

  // Fetch main page + probe sub-paths in parallel
  const pages = await Promise.all([
    tryFetch(url),
    ...ORG_SUB_PATHS.map((p) => tryFetch(base + p)),
  ]);

  const corpus = pages.filter(Boolean).join('\n\n---\n\n').slice(0, 24000);

  if (!corpus.trim()) {
    return NextResponse.json({ error: 'Could not fetch any readable content from the website.' }, { status: 422 });
  }

  // Extract org structure via Claude
  const prompt = `You are extracting organisational structure from a corporate website.
Analyse the text below and return a JSON object with two arrays:

"departments": array of objects with:
  - name: string (department or division name)
  - parent: string | null (parent department name, if known)
  - headPositionName: string | null (title of the head of this department)

"positions": array of objects with:
  - name: string (job title / role name)
  - department: string | null (which department it belongs to)
  - reportsTo: string | null (job title this role reports to)
  - currentHolderName: string | null (person's name if mentioned)
  - vacancy: boolean (true if listed as open/vacant)

Rules:
- Only include what you can confidently extract — omit fields you cannot determine
- Do not invent data
- Keep names consistent (same spelling across departments and positions)
- Prefer specific titles over vague ones
- If the site is not a corporate/company site, return {"departments":[],"positions":[]}

Website: ${url}

Text:
---
${corpus}
---

Respond with ONLY valid JSON, no markdown, no explanation.`;

  let extracted: { departments: any[]; positions: any[] };
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    extracted = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(extracted.departments)) extracted.departments = [];
    if (!Array.isArray(extracted.positions)) extracted.positions = [];
  } catch (err) {
    return NextResponse.json(
      { error: `AI extraction failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  if (extracted.departments.length === 0 && extracted.positions.length === 0) {
    return NextResponse.json({ error: 'No org structure found on this website.' }, { status: 422 });
  }

  // Source tag so scraped records are identifiable
  const sourceTag = `website_scrape:${url}`;

  // Load existing names to avoid duplicates
  const [existingDepts, existingPositions] = await Promise.all([
    db.pmoaDepartment.findMany({ where: { orgId: scope.orgId }, select: { name: true } }),
    db.pmoaPosition.findMany({ where: { orgId: scope.orgId }, select: { name: true } }),
  ]);
  const existingDeptNames = new Set(existingDepts.map((d) => d.name.toLowerCase()));
  const existingPosNames = new Set(existingPositions.map((p) => p.name.toLowerCase()));

  let deptCreated = 0;
  let posCreated = 0;
  let skipped = 0;

  const deptIdByName = new Map<string, string>();

  await db.$transaction(async (tx) => {
    // Departments — skip duplicates
    for (const d of extracted.departments) {
      const name = String(d.name || '').trim();
      if (!name) continue;
      if (existingDeptNames.has(name.toLowerCase())) { skipped++; deptIdByName.set(name, 'existing'); continue; }
      const id = randomUUID();
      deptIdByName.set(name, id);
      await tx.pmoaDepartment.create({
        data: {
          id,
          orgId: scope.orgId,
          name,
          parentId: null,
          headPositionId: null,
          sourceDocumentIds: [sourceTag],
        },
      });
      deptCreated++;
    }

    // Resolve dept parents (only for newly created ones)
    for (const d of extracted.departments) {
      const name = String(d.name || '').trim();
      const parent = String(d.parent || '').trim();
      const id = deptIdByName.get(name);
      const parentId = deptIdByName.get(parent);
      if (id && id !== 'existing' && parentId && parentId !== 'existing') {
        await tx.pmoaDepartment.update({ where: { id }, data: { parentId } });
      }
    }

    // Positions — skip duplicates
    const posIdByName = new Map<string, string>();
    for (const p of extracted.positions) {
      const name = String(p.name || '').trim();
      if (!name) continue;
      if (existingPosNames.has(name.toLowerCase())) { skipped++; continue; }
      if (posIdByName.has(name.toLowerCase())) continue;
      const id = randomUUID();
      posIdByName.set(name.toLowerCase(), id);
      const deptId = p.department ? deptIdByName.get(String(p.department).trim()) : null;
      await tx.pmoaPosition.create({
        data: {
          id,
          orgId: scope.orgId,
          name,
          positionNumber: null,
          reportsToId: null,
          departmentId: (deptId && deptId !== 'existing') ? deptId : null,
          currentHolderName: p.currentHolderName ? String(p.currentHolderName).trim() : null,
          vacancy: !!p.vacancy,
          spanOfControl: 0,
          sourceDocumentIds: [sourceTag],
        },
      });
      posCreated++;
    }

    // Resolve reportsTo
    for (const p of extracted.positions) {
      const name = String(p.name || '').trim().toLowerCase();
      const reportsTo = String(p.reportsTo || '').trim().toLowerCase();
      const id = posIdByName.get(name);
      const reportsToId = posIdByName.get(reportsTo);
      if (id && reportsToId) {
        await tx.pmoaPosition.update({ where: { id }, data: { reportsToId } });
      }
    }

    // Resolve dept heads
    for (const d of extracted.departments) {
      const deptId = deptIdByName.get(String(d.name || '').trim());
      const headName = String(d.headPositionName || '').trim().toLowerCase();
      const headId = posIdByName.get(headName);
      if (deptId && deptId !== 'existing' && headId) {
        await tx.pmoaDepartment.update({ where: { id: deptId }, data: { headPositionId: headId } });
      }
    }
  });

  return NextResponse.json({
    ok: true,
    departments: deptCreated,
    positions: posCreated,
    skipped,
    url,
  });
}
