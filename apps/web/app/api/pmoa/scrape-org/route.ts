/**
 * POST /api/pmoa/scrape-org
 *
 * Fetches the corporate website (main page + a broad set of common sub-paths)
 * and asks Claude to extract the FULL department/position hierarchy — not just
 * executives. Also attempts to discover and follow org-structure-related links
 * found on the main page.
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
export const maxDuration = 120;

const Body = z.object({ url: z.string().url().max(2048) });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Common sub-paths for org/team/leadership pages — English + Polish + Spanish + German
const ORG_SUB_PATHS = [
  // English
  '/about', '/about-us', '/team', '/our-team', '/leadership', '/management',
  '/people', '/company', '/org-chart', '/organizational-structure',
  '/corporate-governance', '/board', '/board-of-directors', '/executives',
  '/departments', '/structure', '/who-we-are', '/meet-the-team',
  // Polish
  '/o-nas', '/o-firmie', '/zarzad', '/wladze', '/kierownictwo',
  '/struktura-organizacyjna', '/struktura', '/organizacja', '/regulamin',
  '/rada-nadzorcza', '/pracownicy', '/zespol', '/kierownictwo-firmy',
  // Common corporate
  '/governance', '/investor-relations/governance', '/ir/governance',
  '/en/about', '/en/team', '/en/leadership', '/en/structure',
];

// Keywords that suggest an org/structure page
const ORG_LINK_KEYWORDS = [
  'org', 'team', 'people', 'leadership', 'management', 'board', 'executive',
  'director', 'department', 'structure', 'governance', 'about',
  'zarzad', 'kierownictwo', 'struktura', 'organizacja', 'o-nas', 'pracownicy',
];

function extractText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract href values from <a> tags in raw HTML */
function extractLinks(html: string, base: string): string[] {
  const hrefs: string[] = [];
  const re = /href=["']([^"'#?]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1].trim();
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    try {
      const absolute = href.startsWith('http') ? href : new URL(href, base).href;
      // Only same-domain links
      if (new URL(absolute).hostname === new URL(base).hostname) {
        hrefs.push(absolute);
      }
    } catch {
      // skip malformed
    }
  }
  return hrefs;
}

async function tryFetch(url: string): Promise<{ text: string; html: string }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JDSuiteBot/1.0; +https://jd-suite-ultra.vercel.app)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { text: '', html: '' };
    const html = await res.text();
    return { text: extractText(html).slice(0, 12_000), html };
  } catch {
    return { text: '', html: '' };
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

  // 1. Fetch main page first to discover org-related links
  const mainPage = await tryFetch(url);
  const discoveredLinks: string[] = [];

  if (mainPage.html) {
    const allLinks = extractLinks(mainPage.html, base);
    for (const link of allLinks) {
      const path = new URL(link).pathname.toLowerCase();
      if (ORG_LINK_KEYWORDS.some((kw) => path.includes(kw))) {
        discoveredLinks.push(link);
      }
    }
  }

  // 2. Fetch known sub-paths + discovered links in parallel (deduplicated)
  const urlsToProbe = [
    ...ORG_SUB_PATHS.map((p) => base + p),
    ...discoveredLinks,
  ];
  const uniqueUrls = [...new Set(urlsToProbe)].slice(0, 60); // cap at 60 probes

  const results = await Promise.all(uniqueUrls.map((u) => tryFetch(u)));

  // Build corpus: main page first, then sub-paths that returned content
  const allTexts = [
    mainPage.text,
    ...results.map((r) => r.text),
  ].filter(Boolean);

  // Cap total corpus at 48k chars (fits in ~12k tokens)
  const corpus = allTexts.join('\n\n---\n\n').slice(0, 48_000);

  if (!corpus.trim()) {
    return NextResponse.json({ error: 'Could not fetch any readable content from the website.' }, { status: 422 });
  }

  // 3. Extract org structure via Claude — use Sonnet for deeper reasoning
  const prompt = `You are extracting the COMPLETE organisational structure from a corporate website. Extract ALL levels — not just executives. Include every department, division, bureau, team, and every named position/role you can identify.

Return a JSON object with two arrays:

"departments": array of objects:
  - name: string (department / division / bureau / team name)
  - parent: string | null (parent department name if known)
  - headPositionName: string | null (title of the department head)

"positions": array of objects:
  - name: string (job title / role name — as specific as possible)
  - department: string | null (which department)
  - reportsTo: string | null (job title this role reports to — must match another position's name exactly)
  - currentHolderName: string | null (person's name if mentioned)
  - vacancy: boolean

CRITICAL RULES:
1. Extract EVERY level of the hierarchy visible in the text — level 1 (CEO/President), level 2 (VP/Director), level 3 (Department Head), level 4 (Manager), level 5+ (Team Lead, Specialist) — whatever is present.
2. If the text mentions department codes (e.g. DAD, DK, DSEK), include them in the department name.
3. Preserve original language (Polish, English, etc.) — do not translate.
4. For each position, carefully determine "reportsTo" based on the structure shown.
5. If you see a list of departments under a VP/Director, create that VP as a position AND all departments as children of their division.
6. Do not invent data. Do not omit data that is present.
7. If the site is not a corporate/company site, return {"departments":[],"positions":[]}.

Website: ${url}

Text content from ${allTexts.filter(Boolean).length} pages:
---
${corpus}
---

Respond with ONLY valid JSON, no markdown, no explanation.`;

  let extracted: { departments: any[]; positions: any[] };
  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
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

    // Resolve dept parents
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
  }, { timeout: 60_000 });

  return NextResponse.json({
    ok: true,
    departments: deptCreated,
    positions: posCreated,
    skipped,
    url,
    pagesScraped: allTexts.filter(Boolean).length,
  });
}
