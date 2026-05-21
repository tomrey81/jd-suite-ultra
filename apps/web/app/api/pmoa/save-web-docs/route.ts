import { NextRequest, NextResponse } from 'next/server';
import { randomUUID, createHash } from 'node:crypto';
import { db } from '@jd-suite/db';
import { requireOrgScope, isScopeError } from '@/lib/pmoa/auth-scope';
import type { ScrapedPage } from '@/lib/pmoa/web-scraper';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;

  const body = await req.json().catch(() => ({}));
  const { pages } = body as { pages?: ScrapedPage[] };

  if (!Array.isArray(pages) || pages.length === 0) {
    return NextResponse.json({ error: 'pages array required' }, { status: 400 });
  }

  const created: string[] = [];

  for (const page of pages) {
    if (!page.url || !page.text) continue;

    const fingerprint = createHash('sha256').update(page.url).digest('hex');

    // Skip if this URL was already saved (idempotent)
    const existing = await db.pmoaDocument.findFirst({
      where: { orgId: scope.orgId, fingerprint },
      select: { id: true },
    });
    if (existing) {
      created.push(existing.id);
      continue;
    }

    const label = page.category === 'org' ? '[Web – Leadership/Org]'
      : page.category === 'ir' ? '[Web – Investor Relations]'
      : '[Web – News/Press]';

    const id = randomUUID();
    await db.pmoaDocument.create({
      data: {
        id,
        orgId: scope.orgId,
        uploaderId: scope.userId,
        documentOwnerId: scope.userId,
        name: `${label} ${page.title || page.url}`.slice(0, 255),
        mime: 'text/plain',
        sizeBytes: page.text.length,
        fingerprint,
        rawText: `Source: ${page.url}\nFetched: ${page.fetchedAt}\n\n${page.text}`,
        pages: 1,
        validityFlag: 'recent',
        parseStatus: 'done',
        parseError: null,
      },
    });
    created.push(id);
  }

  return NextResponse.json({ ok: true, saved: created.length });
}
