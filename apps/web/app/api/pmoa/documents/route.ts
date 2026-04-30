import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { db } from '@jd-suite/db';
import { requireOrgScope, isScopeError } from '@/lib/pmoa/auth-scope';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_FILE_BYTES = 12 * 1024 * 1024;

// GET — list documents for the org
export async function GET() {
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;

  const docs = await db.pmoaDocument.findMany({
    where: { orgId: scope.orgId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, mime: true, sizeBytes: true, fingerprint: true,
      pages: true, validityFlag: true, validityNote: true, documentOwnerId: true,
      parseStatus: true, parseError: true, ocrConfidence: true, createdAt: true,
    },
  });
  return NextResponse.json({ documents: docs });
}

// POST — upload + parse one or more files
export async function POST(req: NextRequest) {
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;

  const form = await req.formData();
  const files = form.getAll('files') as File[];
  if (!files.length) return NextResponse.json({ error: 'No files' }, { status: 400 });

  const created: Array<{ id: string; name: string; status: string }> = [];

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      created.push({ id: '', name: file.name, status: `failed: file > ${MAX_FILE_BYTES / 1024 / 1024} MB` });
      continue;
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const fingerprint = createHash('sha256').update(buf).digest('hex');

    let rawText = '';
    let pages: number | null = null;
    let parseStatus = 'done';
    let parseError: string | null = null;

    const mime = file.type || '';
    const name = file.name || 'upload';

    try {
      if (mime === 'application/pdf' || /\.pdf$/i.test(name)) {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: new Uint8Array(buf) });
        const r = await parser.getText();
        rawText = (r as { text?: string }).text ?? '';
        pages = (r as { numpages?: number }).numpages ?? null;
      } else if (
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        /\.docx$/i.test(name)
      ) {
        const mammoth = (await import('mammoth')).default;
        const r = await mammoth.extractRawText({ buffer: buf });
        rawText = r.value || '';
      } else if (mime.startsWith('image/')) {
        // Defer OCR/vision to extraction step. Just record metadata.
        rawText = '[image — vision-extract on demand]';
      } else if (mime.startsWith('text/') || /\.(txt|md|csv)$/i.test(name)) {
        rawText = buf.toString('utf-8');
      } else if (mime === 'application/json' || /\.json$/i.test(name)) {
        rawText = buf.toString('utf-8');
      } else {
        parseStatus = 'failed';
        parseError = `Unsupported file type: ${mime || 'unknown'}`;
      }
    } catch (err) {
      parseStatus = 'failed';
      parseError = (err as Error).message || 'parse error';
    }

    const id = randomUUID();
    await db.pmoaDocument.create({
      data: {
        id,
        orgId: scope.orgId,
        uploaderId: scope.userId,
        documentOwnerId: scope.userId,
        name,
        mime: mime || null,
        sizeBytes: file.size,
        fingerprint,
        rawText: rawText.slice(0, 1_000_000), // hard cap
        pages,
        validityFlag: 'recent',
        parseStatus,
        parseError,
      },
    });
    created.push({ id, name, status: parseStatus });
  }

  return NextResponse.json({ ok: true, created });
}
