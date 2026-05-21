import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 500 * 1024; // 500 KB
const MAX_CHARS = 12000;

export async function POST(req: NextRequest) {
  const session = await getSession().catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'File exceeds 500 KB limit' },
      { status: 413 },
    );
  }

  const filename = file.name ?? 'unknown';
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let raw: string;

  if (ext === 'txt') {
    raw = buffer.toString('utf-8');
  } else if (ext === 'pdf') {
    let pdfParse: (buf: Buffer) => Promise<{ text: string }>;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import('pdf-parse');
      pdfParse = mod.default ?? mod;
    } catch {
      return NextResponse.json(
        { error: 'pdf-parse module could not be loaded' },
        { status: 500 },
      );
    }
    try {
      const result = await pdfParse(buffer);
      raw = result.text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `PDF extraction failed: ${msg}` },
        { status: 500 },
      );
    }
  } else if (ext === 'docx') {
    let mammoth: { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> };
    try {
      const mod = await import('mammoth');
      mammoth = mod.default ?? mod;
    } catch {
      return NextResponse.json(
        { error: 'mammoth module could not be loaded' },
        { status: 500 },
      );
    }
    try {
      const result = await mammoth.extractRawText({ buffer });
      raw = result.value;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `DOCX extraction failed: ${msg}` },
        { status: 500 },
      );
    }
  } else {
    return NextResponse.json(
      { error: `Unsupported file type: .${ext}` },
      { status: 415 },
    );
  }

  const text = raw.trim().slice(0, MAX_CHARS);

  return NextResponse.json({ text, filename, chars: text.length });
}
