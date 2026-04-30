import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { db } from '@jd-suite/db';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_PER_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 25;

interface ImportedJD {
  ok: boolean;
  filename: string;
  jdId?: string;
  jobTitle?: string;
  charsParsed?: number;
  error?: string;
}

// Naive heading-aware parser. For each file we try common section headings to
// route paragraphs into known fields. AI normalisation is a future pass —
// this gets the file into the library so the user can edit/lint.
const HEADING_MAP: Array<{ test: RegExp; field: string }> = [
  { test: /^(purpose|mission|role summary|job purpose|cel stanowiska)/i, field: 'jobPurpose' },
  { test: /^(key (responsibilities|accountabilities)|responsibilities|what you (will|'ll) do|główne obowiązki|zakres obowiązków)/i, field: 'responsibilities' },
  { test: /^(required skills|must[- ]have|qualifications|wymagania)/i, field: 'minExperience' },
  { test: /^(nice to have|preferred|mile widziane)/i, field: 'minExperience' },
  { test: /^(experience|doświadczenie)/i, field: 'minExperience' },
  { test: /^(education|wykształcenie|qualifications)/i, field: 'minEducation' },
  { test: /^(working conditions|warunki pracy|environment|location)/i, field: 'workLocation' },
];

function classifySections(rawText: string): Record<string, string> {
  const lines = rawText.split(/\r?\n/);
  const out: Record<string, string> = {};
  let currentField: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (currentField && buffer.length) {
      const text = buffer.join('\n').trim();
      if (text) out[currentField] = (out[currentField] || '') + (out[currentField] ? '\n' : '') + text;
    }
    buffer = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { buffer.push(''); continue; }
    // Probable heading: short, ends with colon, or all-caps
    const isHeading = trimmed.length < 80 && (
      trimmed.endsWith(':') ||
      /^[A-ZŁŚŻĄĆĘŃÓŹĄ\s]{4,}$/.test(trimmed) ||
      HEADING_MAP.some((h) => h.test.test(trimmed.replace(/:$/, '')))
    );
    if (isHeading) {
      flush();
      const match = HEADING_MAP.find((h) => h.test.test(trimmed.replace(/:$/, '')));
      currentField = match ? match.field : null;
      continue;
    }
    buffer.push(line);
  }
  flush();
  return out;
}

function extractTitle(rawText: string, filename: string): string {
  const firstLines = rawText.split(/\r?\n/).slice(0, 8);
  for (const l of firstLines) {
    const t = l.trim();
    if (t.length > 3 && t.length < 120 && /[a-zA-Z]/.test(t)) return t;
  }
  // Fall back to filename minus extension
  return filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 120);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  // session.orgId is set by the JWT callback (see lib/auth.ts)
  const orgId = (session as { orgId?: string } | null)?.orgId;
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await req.formData();
  const files = form.getAll('files') as File[];
  const folder = (form.get('folder') as string) || 'Imported';

  if (!files.length) return NextResponse.json({ error: 'No files' }, { status: 400 });
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Too many files (max ${MAX_FILES} per batch).` }, { status: 400 });
  }

  const results: ImportedJD[] = [];

  for (const file of files) {
    if (file.size > MAX_PER_FILE_BYTES) {
      results.push({ ok: false, filename: file.name, error: `File > ${MAX_PER_FILE_BYTES / 1024 / 1024} MB` });
      continue;
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const fingerprint = createHash('sha256').update(buf).digest('hex').slice(0, 12);
    const mime = file.type || '';
    const name = file.name || 'upload';

    let rawText = '';
    try {
      if (mime === 'application/pdf' || /\.pdf$/i.test(name)) {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: new Uint8Array(buf) });
        const r = await parser.getText();
        rawText = (r as { text?: string }).text ?? '';
      } else if (
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        /\.docx$/i.test(name)
      ) {
        const mammoth = (await import('mammoth')).default;
        const r = await mammoth.extractRawText({ buffer: buf });
        rawText = r.value || '';
      } else if (mime.startsWith('text/') || /\.(txt|md)$/i.test(name)) {
        rawText = buf.toString('utf-8');
      } else {
        results.push({ ok: false, filename: name, error: `Unsupported type: ${mime || 'unknown'}` });
        continue;
      }
    } catch (err) {
      results.push({ ok: false, filename: name, error: (err as Error).message });
      continue;
    }

    if (!rawText.trim()) {
      results.push({ ok: false, filename: name, error: 'No text extracted (empty / image-only PDF?)' });
      continue;
    }

    const jobTitle = extractTitle(rawText, name);
    const sections = classifySections(rawText);
    const data = {
      jobTitle,
      // Anything we couldn't route into known fields lives in `notes` so it's not lost
      notes: rawText.length > 6000 ? rawText.slice(0, 6000) + '\n…(truncated)' : rawText,
      ...sections,
      _import: {
        filename: name,
        fingerprint,
        importedAt: new Date().toISOString(),
        recognisedFields: Object.keys(sections),
      },
    };

    try {
      const jdId = randomUUID();
      await db.$transaction(async (tx) => {
        await tx.jobDescription.create({
          data: {
            id: jdId,
            orgId,
            ownerId: userId,
            jobTitle,
            data,
            folder,
            status: 'DRAFT',
          },
        });
        await tx.jDVersion.create({
          data: {
            id: randomUUID(),
            jdId,
            authorId: userId,
            authorType: 'USER',
            changeType: 'IMPORT',
            note: `Bulk-imported from ${name}`,
            data,
          },
        });
      });
      results.push({ ok: true, filename: name, jdId, jobTitle, charsParsed: rawText.length });
    } catch (err) {
      results.push({ ok: false, filename: name, error: (err as Error).message });
    }
  }

  const ok = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: true,
    imported: ok,
    failed: results.length - ok,
    results,
  });
}
