/**
 * POST /api/org-structure/extract
 *
 * Body: { pages: [{ pageNumber: number, dataB64: string }], sourceFile?: string }
 *   - pages are base64 PNGs rendered client-side via pdfjs-dist (or any other
 *     way the caller wants — the route doesn't care).
 *
 * Response: { chart: OrgChart } on success, { error, code } on failure.
 *
 * This route DOES NOT write to the database. It returns the extracted graph
 * for human review on the client. Persistence happens through a separate
 * /api/org-structure/[id]/approve endpoint (next commit).
 */

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/lib/get-session';
import { extractOrgChartFromImages, visionResponseToOrgChart, type PageImage } from '@/lib/org-structure/extract';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const PageSchema = z.object({
  pageNumber: z.number().int().min(1).max(50),
  dataB64: z.string().min(100), // sanity floor; real images are 50KB+
});

const RequestSchema = z.object({
  pages: z.array(PageSchema).min(1).max(8),
  sourceFile: z.string().optional(),
});

export async function POST(req: Request) {
  // Auth — fail closed
  const session = await getSession().catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  // Body
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'BAD_REQUEST' }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', code: 'BAD_REQUEST', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error: 'Org-structure extraction is not configured. Set ANTHROPIC_API_KEY.',
        code: 'NOT_CONFIGURED',
      },
      { status: 503 },
    );
  }

  const pages: PageImage[] = parsed.data.pages.map((p) => ({
    pageNumber: p.pageNumber,
    dataB64: p.dataB64,
  }));

  try {
    const vision = await extractOrgChartFromImages({ pages });
    const chart = visionResponseToOrgChart(vision, {
      sourceFile: parsed.data.sourceFile || 'org-chart.pdf',
      chartId: randomUUID(),
    });
    return NextResponse.json({ chart });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed';
    console.error('[org-structure/extract] error:', message);
    return NextResponse.json({ error: message, code: 'EXTRACTION_FAILED' }, { status: 502 });
  }
}
