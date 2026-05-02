/**
 * POST /api/company/scrape
 *
 * Fetches a company website and uses Claude to extract identity fields
 * that can pre-populate the Company Profile form.
 *
 * Body: { url: string }
 * Returns: { fields: Partial<ScrapedIdentity>; confidence: Record<string, 'high'|'low'> }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const Body = z.object({ url: z.string().url().max(2048) });

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** Strip HTML tags and collapse whitespace — keep only visible text. */
function extractText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000); // cap to keep tokens reasonable
}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Provide a valid URL' }, { status: 400 });
  }

  const { url } = parsed.data;

  // Fetch the page
  let pageText = '';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JDSuiteBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    pageText = extractText(html);
  } catch (err) {
    return NextResponse.json(
      { error: `Could not fetch the website: ${(err as Error).message}` },
      { status: 422 },
    );
  }

  if (!pageText) {
    return NextResponse.json({ error: 'Page returned no readable text' }, { status: 422 });
  }

  // Ask Claude to extract company identity fields
  const prompt = `You are extracting company profile data from a corporate website.
Analyze the text below and extract as many fields as you can confidently identify.
Return a JSON object with ONLY the fields you found — omit any you are unsure about.
Do not invent data. Prefer specific over vague values.

Fields to extract:
- legalName: string — full legal company name (look for "Sp. z o.o.", "GmbH", "Ltd", "S.A.", etc.)
- displayName: string — brand / group name (shorter, from logo alt text, title, tagline)
- industry: string — concise sector e.g. "Logistics & Supply Chain", "Technology", "Retail"
- countryHq: string — 2-letter ISO code of HQ country (e.g. "PL", "DE", "FR")
- countriesInScope: string — comma-separated ISO codes of countries where company operates
- mainLanguage: string — primary language of operations (e.g. "English", "Polish")
- defaultCurrency: string — primary currency used (e.g. "EUR", "PLN", "USD")
- timezone: string — IANA timezone string (e.g. "Europe/Warsaw")
- size: string — one of: "micro", "small", "medium", "large" (based on employee count if mentioned)
- totalFte: string — number of employees/FTE if mentioned

Website URL: ${url}

Website text:
---
${pageText}
---

Respond with ONLY a valid JSON object, no markdown, no explanation. Example:
{"legalName":"Acme Polska Sp. z o.o.","displayName":"Acme","industry":"Technology","countryHq":"PL"}`;

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    // Extract JSON even if the model adds some prefix text
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI returned no structured data' }, { status: 502 });
    }

    const fields = JSON.parse(jsonMatch[0]);

    // Sanitise: only allow known keys, all string values
    const allowed = ['legalName', 'displayName', 'industry', 'countryHq', 'countriesInScope', 'mainLanguage', 'defaultCurrency', 'timezone', 'size', 'totalFte'];
    const clean: Record<string, string> = {};
    for (const key of allowed) {
      if (key in fields && typeof fields[key] === 'string' && fields[key].trim()) {
        clean[key] = fields[key].trim();
      }
    }

    return NextResponse.json({ fields: clean, url });
  } catch (err) {
    return NextResponse.json(
      { error: `AI extraction failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
