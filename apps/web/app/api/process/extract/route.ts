import { NextRequest, NextResponse } from 'next/server';
import { callClaudeForExtraction, parseExtractionJSON, type ClaudeMessage } from '@/lib/process-extract';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SUPPORTED_TEXT_MIME = new Set([
  'text/plain', 'text/markdown', 'text/csv',
]);
const SUPPORTED_IMAGE_MIME = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
]);

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const pasted = (form.get('text') as string | null) || '';

    let userMessage: ClaudeMessage;

    if (pasted && pasted.trim().length > 0) {
      if (pasted.length > 200_000) {
        return NextResponse.json({ error: 'Pasted text too large (max 200k chars)' }, { status: 413 });
      }
      userMessage = {
        role: 'user',
        content: `Below is a process description / RASCI table / set of internal rules. Extract the structured map per the system prompt.\n\n---\n${pasted}\n---`,
      };
    } else if (file) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: 'File exceeds 8 MB limit' }, { status: 413 });
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const mime = file.type || '';
      const name = file.name || 'upload';

      if (SUPPORTED_IMAGE_MIME.has(mime)) {
        userMessage = {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: buf.toString('base64') } },
            { type: 'text', text: 'This image is a process flow chart or RASCI table. Extract the structured map per the system prompt.' },
          ],
        };
      } else if (mime === 'application/pdf' || /\.pdf$/i.test(name)) {
        // pdf-parse v2 has a class-based API
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: new Uint8Array(buf) });
        const result = await parser.getText();
        const text = (result as { text?: string }).text ?? '';
        if (!text || text.trim().length < 20) {
          return NextResponse.json({ error: 'PDF appears to be image-only or empty. Re-upload as PNG/JPG.' }, { status: 400 });
        }
        userMessage = {
          role: 'user',
          content: `Below is text extracted from a PDF (${name}). Extract the structured map per the system prompt.\n\n---\n${text.slice(0, 200_000)}\n---`,
        };
      } else if (
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        /\.docx$/i.test(name)
      ) {
        const mammoth = (await import('mammoth')).default;
        const result = await mammoth.extractRawText({ buffer: buf });
        if (!result.value || result.value.trim().length < 20) {
          return NextResponse.json({ error: 'DOCX appears to be empty.' }, { status: 400 });
        }
        userMessage = {
          role: 'user',
          content: `Below is text extracted from a DOCX (${name}). Extract the structured map per the system prompt.\n\n---\n${result.value.slice(0, 200_000)}\n---`,
        };
      } else if (SUPPORTED_TEXT_MIME.has(mime) || /\.(txt|md|csv)$/i.test(name)) {
        const text = buf.toString('utf-8');
        userMessage = {
          role: 'user',
          content: `Below is the contents of ${name}. Extract the structured map per the system prompt.\n\n---\n${text.slice(0, 200_000)}\n---`,
        };
      } else {
        return NextResponse.json(
          { error: `Unsupported file type: ${mime || 'unknown'}. Use PDF, DOCX, TXT, or an image.` },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json({ error: 'Provide either a file or pasted text.' }, { status: 400 });
    }

    const raw = await callClaudeForExtraction([userMessage]);
    let parsed;
    try {
      parsed = parseExtractionJSON(raw);
    } catch (err) {
      return NextResponse.json(
        { error: 'AI returned malformed JSON. Try a clearer source or smaller chunk.', raw: raw.slice(0, 500) },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, extracted: parsed });
  } catch (err) {
    const msg = (err as Error).message || 'Extraction failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
