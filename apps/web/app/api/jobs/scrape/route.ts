import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchAsBrowser } from '@/lib/job-fetch';
import { AI_MODEL } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/jobs/scrape
// Body: { url: string, htmlOverride?: string }
//
// Fetches a careers page (or accepts pasted HTML), then runs Claude on
// the cleaned text to extract structured job openings. Returns a list
// of jobs or — if the site blocks us — a clear, actionable error
// telling the user to paste HTML manually.

interface Body { url?: string; htmlOverride?: string }

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  let html = body.htmlOverride?.trim() || '';
  let sourceUrl = body.url?.trim() || '';

  if (!html) {
    if (!sourceUrl) {
      return NextResponse.json({ error: 'Provide either url or htmlOverride' }, { status: 400 });
    }
    if (!/^https?:\/\//i.test(sourceUrl)) sourceUrl = 'https://' + sourceUrl;
    const fetched = await fetchAsBrowser(sourceUrl);
    if (!fetched.ok || !fetched.html) {
      return NextResponse.json({
        error: fetched.error || 'Fetch failed',
        canRetryWithPaste: true,
        hint: 'Open the careers page in your browser, copy the HTML (View Source → Cmd+A → Cmd+C), and paste it here.',
      }, { status: 502 });
    }
    html = fetched.html;
  }

  // Strip <script>, <style>, comments, and most attributes — keeps tokens
  // sane and removes obvious noise. Preserve text + href anchors.
  const cleaned = stripHtmlNoise(html).slice(0, 60_000);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 503 });
  }

  const aiPrompt = `You are extracting current job openings from a careers webpage. Output STRICT JSON only.

Schema:
{
  "jobs": [{
    "title": string,
    "location": string,
    "department": string,
    "url": string,    // absolute URL if visible; relative if not
    "snippet": string // 1-2 sentence summary if visible, else ""
  }],
  "siteType": string,           // e.g. "Workday", "Greenhouse", "Lever", "Custom careers page"
  "notes": string                // 1 line — anything important about this page (e.g. "results paginated, only 10 of 50 visible")
}

Rules:
- Only include actual job postings, not navigation or filters.
- If no jobs found, return jobs: [].
- NEVER fabricate URLs or titles. If a field isn't visible, return "".
- Output JSON only — no prose, no markdown fences.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 3000,
        system: aiPrompt,
        messages: [{
          role: 'user',
          content: `Source URL: ${sourceUrl || '(pasted HTML)'}\n\n${cleaned}`,
        }],
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return NextResponse.json({ error: e.error?.message || `AI ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    const text = (data.content?.[0]?.text || '').trim();
    let parsed;
    try {
      let t = text;
      if (t.startsWith('```')) t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const a = t.indexOf('{');
      const b = t.lastIndexOf('}');
      if (a >= 0 && b > a) t = t.slice(a, b + 1);
      parsed = JSON.parse(t);
    } catch {
      return NextResponse.json({
        error: 'AI returned malformed JSON. Try pasting only the listings section.',
        raw: text.slice(0, 300),
      }, { status: 502 });
    }

    // Resolve relative URLs against the source URL if we have one
    if (sourceUrl && Array.isArray(parsed.jobs)) {
      try {
        const base = new URL(sourceUrl);
        parsed.jobs = parsed.jobs.map((j: { url?: string }) => {
          if (j.url && !/^https?:\/\//i.test(j.url)) {
            try { j.url = new URL(j.url, base).toString(); } catch { /* keep as-is */ }
          }
          return j;
        });
      } catch {
        // base URL invalid — leave urls as model returned them
      }
    }

    return NextResponse.json({
      ok: true,
      jobs: parsed.jobs || [],
      siteType: parsed.siteType || 'Unknown',
      notes: parsed.notes || '',
      sourceUrl: sourceUrl || null,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || 'AI extraction failed' }, { status: 500 });
  }
}

function stripHtmlNoise(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
