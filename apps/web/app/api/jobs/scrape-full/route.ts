import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';
import { fetchAsBrowser } from '@/lib/job-fetch';
import { callClaude } from '@/lib/ai';
import { z } from 'zod';

export const maxDuration = 60;

const requestSchema = z.object({
  url: z.string().url().optional(),
  htmlOverride: z.string().optional(),
  /** Optional title hint from the search result; AI will prefer the page's own title if found */
  jobTitleHint: z.string().optional(),
  /** Optional company hint from the search result */
  companyHint: z.string().optional(),
  sourceUrl: z.string().url().optional(),
});

interface ExtractedJD {
  jobTitle: string;
  company: string;
  location: string;
  jobPurpose: string;
  responsibilities: string;
  minExperience: string;
  minEducation: string;
  systems: string;
  workLocation: string;
  workingConditions: string;
  rawText: string;
}

const SYSTEM_PROMPT = `You extract a complete job description from a careers page HTML. Return ONLY a single JSON object with the exact fields below. No commentary.

Rules:
- Preserve the EXACT wording from the page wherever possible. Do not paraphrase.
- For multi-bullet sections (Responsibilities, Requirements), preserve original order.
- If a field is not present in the page, return an empty string.
- "rawText" must contain the FULL JD body in plain text (sections labelled, bullets preserved). This is the most important field.

Output JSON shape:
{
  "jobTitle": "string",
  "company": "string",
  "location": "string",
  "jobPurpose": "1-3 sentences from the page (or empty)",
  "responsibilities": "Plain-text bullet list, one per line, preserving page wording",
  "minExperience": "Verbatim from page or empty",
  "minEducation": "Verbatim from page or empty",
  "systems": "Tools/systems mentioned, one per line, or empty",
  "workLocation": "Remote/hybrid/onsite + city if mentioned, or empty",
  "workingConditions": "Schedule, travel, physical demands if mentioned, or empty",
  "rawText": "FULL JD body as plain text — every section, every bullet, all original wording preserved. Include section headings."
}`;

function cleanHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = session?.orgId;
  if (!orgId) return NextResponse.json({ error: 'No organisation' }, { status: 403 });

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json({ error: 'Invalid request', details: err.message }, { status: 400 });
  }

  const { url, htmlOverride, jobTitleHint, companyHint, sourceUrl } = body;
  if (!url && !htmlOverride) {
    return NextResponse.json({ error: 'Provide either url or htmlOverride' }, { status: 400 });
  }

  // 1. Fetch HTML
  let html = htmlOverride;
  let finalUrl = url || sourceUrl;
  if (!html && url) {
    const fetched = await fetchAsBrowser(url, { timeout: 25_000 });
    if (!fetched.ok || !fetched.html) {
      return NextResponse.json(
        {
          error: fetched.error || `Could not fetch URL (HTTP ${fetched.status})`,
          canRetryWithPaste: true,
          hint: 'Try opening the page in your browser, View Source, copy the HTML, and paste it instead.',
        },
        { status: 422 },
      );
    }
    html = fetched.html;
    finalUrl = fetched.finalUrl || url;
  }

  // 2. Clean and trim HTML
  const cleaned = cleanHtml(html!).slice(0, 80_000);

  // 3. Extract structured JD via Claude
  const userMessage = `Source URL: ${finalUrl || 'pasted HTML'}
${jobTitleHint ? `Search-result title hint: ${jobTitleHint}` : ''}
${companyHint ? `Search-result company hint: ${companyHint}` : ''}

HTML:
"""
${cleaned}
"""

Extract the full job description as JSON per the system prompt.`;

  let extracted: ExtractedJD;
  try {
    const aiText = await callClaude(SYSTEM_PROMPT, userMessage, 6000,
      { operation: 'jobs.scrapeExtract', context: { orgId, userId: session!.user.id } });
    const cleanedJson = aiText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    extracted = JSON.parse(cleanedJson);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Could not extract JD from page', details: err.message },
      { status: 502 },
    );
  }

  if (!extracted.rawText || extracted.rawText.length < 100) {
    return NextResponse.json(
      { error: 'Page did not contain a usable job description body', hint: 'The page may be a job listing index rather than a single JD detail page.' },
      { status: 422 },
    );
  }

  // 4. Save as a JobDescription in JD Hub
  const today = new Date();
  const folder = `Scraped JDs ${today.toISOString().slice(0, 10)}`;

  const jdData: Record<string, string> = {
    jobTitle: extracted.jobTitle || jobTitleHint || 'Untitled (scraped)',
    jobPurpose: extracted.jobPurpose || '',
    responsibilities: extracted.responsibilities || '',
    minExperience: extracted.minExperience || '',
    minEducation: extracted.minEducation || '',
    systems: extracted.systems || '',
    workLocation: extracted.workLocation || '',
    workingConditions: extracted.workingConditions || '',
    notes: `Scraped from: ${finalUrl || 'manual paste'}\nCompany: ${extracted.company || companyHint || ''}\nLocation: ${extracted.location || ''}\nScrape date: ${today.toISOString()}\n\nFull JD body:\n${extracted.rawText}`,
  };

  const jd = await db.$transaction(async (tx) => {
    const created = await tx.jobDescription.create({
      data: {
        orgId,
        ownerId: session!.user.id,
        data: jdData,
        jobTitle: jdData.jobTitle,
        orgUnit: extracted.company || companyHint || undefined,
        folder,
        status: 'DRAFT',
      },
    });

    await tx.jDVersion.create({
      data: {
        jdId: created.id,
        authorId: session!.user.id,
        authorType: 'USER',
        changeType: 'IMPORT',
        note: `Scraped from ${finalUrl || 'pasted HTML'} on ${today.toISOString()}`,
        data: jdData,
      },
    });

    return created;
  });

  return NextResponse.json({
    ok: true,
    jdId: jd.id,
    folder,
    jobTitle: jd.jobTitle,
    redirectTo: `/jd/${jd.id}`,
    extracted: {
      jobTitle: extracted.jobTitle,
      company: extracted.company,
      location: extracted.location,
      bodyLength: extracted.rawText.length,
    },
  }, { status: 201 });
}
