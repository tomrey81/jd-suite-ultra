import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { db } from '@jd-suite/db';
import { auth } from '@/lib/auth';
import { callAi, extractJson } from '@/lib/ai/call-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_PER_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 25;
// Feed at most this many characters to Claude per document (cost control).
const AI_TEXT_LIMIT = 15_000;

interface ImportedJD {
  ok: boolean;
  filename: string;
  jdId?: string;
  jobTitle?: string;
  charsParsed?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// AI field extraction
// ---------------------------------------------------------------------------

const AI_SYSTEM_PROMPT = `You are a structured data extractor for job description documents.

Your ONLY job is to read the raw text of a job description (in any language, any format) and return a JSON object that maps the content into the following exact field IDs. Read the whole document carefully before assigning text to any field.

FIELD DEFINITIONS — fill every field you can find evidence for; leave the rest as empty string "":

jobTitle       — The official job title of this role. NOT the document heading like "JOB DESCRIPTION" or "STANOWISKO PRACY". Extract the actual role name (e.g. "Senior Financial Controller", "Head of Logistics", "Software Engineer II"). If the document starts with a generic heading, skip it and look for the real title in the body.
jobCode        — Internal job code or position number, if present.
orgUnit        — Organisational unit, department, division, or reporting entity (e.g. "Finance / Central Europe", "Operations — Warsaw HQ").
jobFamily      — Job function or job family (e.g. "Finance", "Engineering", "Sales").
positionType   — "Individual Contributor" or "People Manager". Infer from the text if not stated.
jobPurpose     — 2-3 sentence summary of what the role exists to do, for whom, and why. Write in third person. Do NOT list tasks. If the document has a "Purpose" or "Role Summary" section, use that.
minEducation   — Minimum education or qualification requirements (e.g. degree level, EQF level, certifications). Use the document's exact wording if available.
minExperience  — Minimum years of experience and any domain-specific experience requirements. Use the document's exact wording if available.
keyKnowledge   — Domain knowledge areas required (e.g. IFRS, SAP, supply chain, tax law). List them clearly.
languageReqs   — Language requirements with proficiency levels if stated (e.g. "English C1, Polish native").
responsibilities — Core accountabilities of the role. Use active verbs. Preserve bullet structure from the source if present. Include ALL responsibilities listed in the document.
problemComplexity — Description of the typical complexity of problems this role solves (routine/defined/novel/strategic). Infer from context if not explicitly stated.
planningScope  — Planning horizon and scope (e.g. "Plans own work week", "Leads cross-functional projects over 6-month cycles").
internalStakeholders — Internal contacts and the nature of interaction (e.g. "CFO — monthly budget reviews", "HR team — day-to-day coordination").
externalContacts — External contacts if any (clients, vendors, regulators, auditors).
communicationMode — Highest level of communication required: information exchange / persuasion / negotiation / conflict resolution / strategic influence. Infer from responsibilities if not stated.
systems        — Required IT systems, software, tools. Mark each as R (required) or P (preferred) where inferable.
physicalSkills — Any physical or manual skills required. Leave empty if none.
peopleManagement — Number of direct and indirect reports, and type of management (operational, project, matrix). State "None" if individual contributor.
budgetAuthority — Financial approval authority or budget responsibility. State "None" if not applicable.
impactScope    — Scope of the role's impact: number of people affected, revenue or cost controlled, geographic scope.
workLocation   — Work location, country/city, and remote/hybrid/on-site arrangement.
travelReqs     — Travel frequency and destinations, if stated.
workingConditions — Specific working conditions: deadline pressure, shift work, emotional demands, confidentiality requirements, hazardous environments.
benchmarkRefs  — Comparable roles or benchmark references mentioned, if any.
proposedGrade  — Proposed grade, band, or level, if stated.

RULES:
1. Return ONLY a valid JSON object. No markdown fences. No explanations. No extra keys.
2. All values must be strings. Use "\\n" for line breaks within multi-line fields.
3. jobTitle must never be a generic document heading ("JOB DESCRIPTION", "OPIS STANOWISKA", "ROLE PROFILE", etc.). If that is the only title-like text, look deeper in the document.
4. Copy source text faithfully — do not invent, summarise, or omit material content.
5. If a field genuinely has no corresponding content in the document, set it to "".`;

interface ExtractedFields {
  jobTitle?: string;
  jobCode?: string;
  orgUnit?: string;
  jobFamily?: string;
  positionType?: string;
  jobPurpose?: string;
  minEducation?: string;
  minExperience?: string;
  keyKnowledge?: string;
  languageReqs?: string;
  responsibilities?: string;
  problemComplexity?: string;
  planningScope?: string;
  internalStakeholders?: string;
  externalContacts?: string;
  communicationMode?: string;
  systems?: string;
  physicalSkills?: string;
  peopleManagement?: string;
  budgetAuthority?: string;
  impactScope?: string;
  workLocation?: string;
  travelReqs?: string;
  workingConditions?: string;
  benchmarkRefs?: string;
  proposedGrade?: string;
}

async function extractFieldsWithAI(
  rawText: string,
  filename: string,
  orgId: string,
  userId: string,
): Promise<ExtractedFields> {
  const result = await callAi({
    operation: 'jd.bulkImport.extractFields',
    tier: 'haiku',
    systemPrompt: AI_SYSTEM_PROMPT,
    userPrompt: `Extract fields from this job description document (filename: "${filename}"):\n\n${rawText.slice(0, AI_TEXT_LIMIT)}`,
    maxTokens: 3000,
    temperature: 0,
    context: { orgId, userId },
  });

  try {
    return extractJson<ExtractedFields>(result.text);
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Title fallback — only used when AI returns empty or a generic heading
// ---------------------------------------------------------------------------

const GENERIC_HEADINGS = new Set([
  'job description', 'opis stanowiska', 'opis stanowiska pracy', 'stanowisko pracy',
  'role profile', 'position description', 'job profile', 'job specification',
  'karta stanowiska', 'karta opisu stanowiska', 'job posting', 'vacancy',
]);

function isGenericHeading(s: string): boolean {
  return GENERIC_HEADINGS.has(s.toLowerCase().trim());
}

function titleFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 120);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
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
        await parser.destroy();
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

    let fields: ExtractedFields = {};
    try {
      fields = await extractFieldsWithAI(rawText, name, orgId, userId);
    } catch {
      // AI call failed — proceed with empty fields so the JD still imports.
    }

    // Ensure jobTitle is never empty or a generic heading.
    const aiTitle = (fields.jobTitle ?? '').trim();
    const jobTitle = (aiTitle && !isGenericHeading(aiTitle)) ? aiTitle : titleFromFilename(name);

    const data: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [k, v ?? '']),
      ),
      jobTitle,
      // Full raw text preserved in notes so nothing is permanently lost.
      notes: rawText.length > 8000 ? rawText.slice(0, 8000) + '\n…(truncated)' : rawText,
      _import: JSON.stringify({
        filename: name,
        fingerprint,
        importedAt: new Date().toISOString(),
      }),
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
