import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { callClaude, JD_SYSTEM_PROMPT } from '@/lib/ai';
import {
  TEMPLATE_IMPORT_SYSTEM_PROMPT,
  buildTemplateImportPrompt,
} from '@/lib/ai/template-import-prompt';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_CHARS = 20000;

async function extractText(buffer: Buffer, ext: string): Promise<string> {
  if (ext === 'txt') {
    return buffer.toString('utf-8');
  }

  if (ext === 'pdf') {
    const mod: any = await import('pdf-parse');
    const pdfParse = mod.default ?? mod;
    const result = await pdfParse(buffer);
    return result.text as string;
  }

  if (ext === 'docx') {
    const mod = await import('mammoth');
    const mammoth: any = mod.default ?? mod;
    const result = await mammoth.extractRawText({ buffer });
    return result.value as string;
  }

  if (ext === 'xlsx') {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const lines: string[] = [];
    workbook.eachSheet((sheet) => {
      lines.push(`[Sheet: ${sheet.name}]`);
      sheet.eachRow((row) => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: false }, (cell) => {
          const v = cell.text ?? String(cell.value ?? '');
          if (v.trim()) cells.push(v.trim());
        });
        if (cells.length) lines.push(cells.join('\t'));
      });
    });
    return lines.join('\n');
  }

  if (ext === 'pptx') {
    // PPTX is a ZIP archive. We use the jszip package when available.
    // If jszip is not installed, fall back to a raw buffer text scan which
    // works for uncompressed or lightly-compressed XML runs (not perfect but
    // sufficient for template structure recognition).
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(buffer);
      const slideFiles = Object.keys(zip.files).filter(
        (name) => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'),
      );
      const texts: string[] = [];
      for (const name of slideFiles) {
        const xml = await zip.files[name].async('text');
        const matches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) ?? [];
        for (const m of matches) {
          const t = m.replace(/<[^>]+>/g, '').trim();
          if (t) texts.push(t);
        }
      }
      return texts.join('\n');
    } catch {
      // Fallback: scan raw buffer for XML text runs
      const raw = buffer.toString('latin1');
      const matches = raw.match(/<a:t[^>]*>([^<]{1,500})<\/a:t>/g) ?? [];
      return matches.map((m) => m.replace(/<[^>]+>/g, '').trim()).filter(Boolean).join('\n');
    }
  }

  throw new Error(`Unsupported file type: .${ext}`);
}

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
  const supported = ['txt', 'pdf', 'docx', 'xlsx', 'pptx'];
  if (!supported.includes(ext)) {
    return NextResponse.json(
      { error: `Unsupported file type .${ext}. Accepted: ${supported.join(', ')}` },
      { status: 415 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let rawText: string;
  try {
    rawText = (await extractText(buffer, ext)).trim().slice(0, MAX_CHARS);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Text extraction failed: ${msg}` }, { status: 500 });
  }

  if (rawText.length < 50) {
    return NextResponse.json({ error: 'Could not extract meaningful text from the file' }, { status: 422 });
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
