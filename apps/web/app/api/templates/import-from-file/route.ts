import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { callClaude } from '@/lib/ai';
import {
  TEMPLATE_IMPORT_SYSTEM_PROMPT,
  buildTemplateImportPrompt,
} from '@/lib/ai/template-import-prompt';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_CHARS = 20_000;

const SUPPORTED_EXTENSIONS = ['txt', 'pdf', 'docx', 'xlsx', 'pptx'] as const;
type SupportedExt = (typeof SUPPORTED_EXTENSIONS)[number];

function isSupportedExt(ext: string): ext is SupportedExt {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------

async function extractText(buffer: Buffer, ext: SupportedExt): Promise<string> {
  switch (ext) {
    case 'txt': {
      return buffer.toString('utf-8');
    }

    case 'pdf': {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      return (result.text as string) ?? '';
    }

    case 'docx': {
      const mammoth = (await import('mammoth')).default;
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    case 'xlsx': {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
      const lines: string[] = [];
      workbook.eachSheet((sheet) => {
        lines.push(`[Sheet: ${sheet.name}]`);
        sheet.eachRow((row) => {
          const cells: string[] = [];
          row.eachCell({ includeEmpty: false }, (cell) => {
            const v = cell.text || String(cell.value ?? '');
            if (v.trim()) cells.push(v.trim());
          });
          if (cells.length) lines.push(cells.join('\t'));
        });
      });
      return lines.join('\n');
    }

    case 'pptx': {
      return extractPptxText(buffer);
    }
  }
}

// PPTX is a ZIP of XML files. We use jszip when available; the fallback scans
// the raw buffer for uncompressed XML text runs, which is sufficient for
// template structure recognition on lightly-compressed slides.
async function extractPptxText(buffer: Buffer): Promise<string> {
  try {
    // @ts-ignore - jszip is an optional peer not in package.json; fallback below
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);

    const slideFiles = Object.keys(zip.files).filter(
      (name) => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'),
    );

    const texts: string[] = [];
    for (const name of slideFiles) {
      const xml = await zip.files[name].async('text') as string;
      const matches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) ?? [];
      for (const m of matches) {
        const t = m.replace(/<[^>]+>/g, '').trim();
        if (t) texts.push(t);
      }
    }
    return texts.join('\n');
  } catch {
    // jszip not installed or ZIP parse failed: scan raw buffer for text runs.
    // This covers uncompressed slides and is accurate enough for AI analysis.
    const raw = buffer.toString('latin1');
    const matches = raw.match(/<a:t[^>]*>([^<]{1,500})<\/a:t>/g) ?? [];
    return matches
      .map((m) => m.replace(/<[^>]+>/g, '').trim())
      .filter(Boolean)
      .join('\n');
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await getSession().catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.orgId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const suggestedName = (form.get('name') as string | null)?.trim() || 'Imported Template';

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 2 MB limit' }, { status: 413 });
  }

  const ext = (file.name ?? '').split('.').pop()?.toLowerCase() ?? '';
  if (!isSupportedExt(ext)) {
    return NextResponse.json(
      { error: `Unsupported file type .${ext}. Accepted: ${SUPPORTED_EXTENSIONS.join(', ')}` },
      { status: 415 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let rawText: string;
  try {
    rawText = (await extractText(buffer, ext)).trim().slice(0, MAX_CHARS);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Text extraction failed: ${msg}` }, { status: 500 });
  }

  if (rawText.length < 50) {
    return NextResponse.json(
      { error: 'Could not extract meaningful text from the file' },
      { status: 422 },
    );
  }

  try {
    const raw = await callClaude(
      TEMPLATE_IMPORT_SYSTEM_PROMPT,
      buildTemplateImportPrompt(rawText, suggestedName),
      8000,
      {
        operation: 'template.importFromFile',
        context: { orgId: session.orgId, userId: session.user.id },
      },
    );

    const result = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
    return NextResponse.json(result);
  } catch (err) {
    console.error('Template import AI error:', err);
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 });
  }
}
