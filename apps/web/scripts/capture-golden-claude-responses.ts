#!/usr/bin/env npx tsx
/**
 * capture-golden-claude-responses.ts
 *
 * Captures real Claude R and E extraction responses for all 15 golden fixtures.
 * Writes results to apps/web/tests/golden/claude-fixtures/
 *
 * USAGE:
 *   cd apps/web
 *   ANTHROPIC_API_KEY=sk-ant-... GOLDEN_FIXTURES_PATH=~/Desktop/jd-suite-golden/golden-jd-fixtures.json \
 *     npx tsx scripts/capture-golden-claude-responses.ts
 *
 * FLAGS:
 *   --dry-run      Print prompts without calling Claude
 *   --fixture G-01 Capture only one fixture (repeatable)
 *   --force        Re-capture even if file already exists
 *
 * OUTPUT:
 *   tests/golden/claude-fixtures/G-{01..15}.r-extract.json
 *   tests/golden/claude-fixtures/G-{01..15}.e-extract.json
 *   tests/golden/claude-fixtures/manifest.json
 *
 * Files are gitignored (contain confidential JD analysis).
 * Upload to GDrive alongside golden-jd-fixtures.json.
 *
 * RATE LIMITING: 1.5s pause between API calls (30 total calls for 15 fixtures).
 * Total runtime: ~2–3 min assuming p50 latency of ~3s/call.
 *
 * RESUMABILITY: if a capture file already exists, it is skipped unless --force.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { R_HYPOTHESES } from '../lib/axiomera/hypotheses/r-hypotheses';
import { E_HYPOTHESES } from '../lib/axiomera/hypotheses/e-hypotheses';
import type { GoldenFixture, GoldenFixtureFile } from '../lib/golden/types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SCRIPT_DIR = path.resolve(import.meta.dirname ?? __dirname);
const WEB_ROOT = path.resolve(SCRIPT_DIR, '..');
const OUT_DIR = path.resolve(WEB_ROOT, 'tests/golden/claude-fixtures');
const MANIFEST_PATH = path.resolve(OUT_DIR, 'manifest.json');
const DEFAULT_FIXTURE_PATH = path.resolve(
  process.env.HOME ?? '~',
  'Desktop/jd-suite-golden/golden-jd-fixtures.json',
);

const MODEL_ID = 'claude-sonnet-4-6';
const MAX_TOKENS = 4096;
const RATE_LIMIT_MS = 1500;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const fixtureFilter = (() => {
  const idx = args.indexOf('--fixture');
  if (idx === -1) return null;
  return args.slice(idx + 1).filter((a) => !a.startsWith('--'));
})();

// ---------------------------------------------------------------------------
// Prompts — identical to extract-r.ts / extract-e.ts
// ---------------------------------------------------------------------------

const R_SYSTEM_PROMPT = `You are a job-evaluation expert. Your job is to detect the presence of 19 empirically-validated Responsibility hypotheses (R-hypotheses) in a job description. Each hypothesis is binary: active (1) or not active (0).

For each active hypothesis you MUST extract an exact literal quote from the JD text that supports the activation. Do not paraphrase.

Return ONLY valid JSON matching this TypeScript type:
{
  "activations": Array<{ "key": string; "active": boolean; "evidence": string | null }>
}

Rules:
- "key" must exactly match one of the 19 hypothesis keys provided.
- If a hypothesis is not clearly supported, set active=false and evidence=null.
- If active=true, "evidence" MUST be a verbatim substring from the JD.
- Do not invent quotes. Do not add keys outside the 19 provided.
- Be conservative: when in doubt, mark inactive.`;

const E_SYSTEM_PROMPT = `You are a job-evaluation expert applying the Job Demands–Resources model (Bakker & Demerouti, 2007). Your job is to detect the presence of 45 empirically-validated Effort hypotheses (E-hypotheses) in a job description. Each hypothesis is binary: active (1) or not active (0).

Dimensions:
- COG (cognitive effort)
- EMO (emotional effort, Hochschild emotional labor)
- PHY (physical effort)

Types:
- P = primary hypothesis (single demand)
- I = interaction hypothesis (co-activation of two or three demands — mark active ONLY if ALL components are clearly present in the JD)

For each active hypothesis you MUST extract an exact literal quote from the JD text that supports the activation. Do not paraphrase.

Return ONLY valid JSON matching this TypeScript type:
{
  "activations": Array<{ "key": string; "active": boolean; "evidence": string | null }>
}

Rules:
- "key" must exactly match one of the 45 hypothesis keys provided.
- If a hypothesis is not clearly supported, set active=false and evidence=null.
- If active=true, "evidence" MUST be a verbatim substring from the JD.
- For interaction hypotheses (type I), require evidence of BOTH components in the JD.
- Be conservative: when in doubt, mark inactive.`;

function buildRUserPrompt(jdText: string): string {
  const hypothesisList = R_HYPOTHESES.map(
    (h) =>
      `- ${h.key}  (level ${h.level})\n  PL: ${h.label_pl}\n  EN: ${h.label_en}\n  DE: ${h.label_de}\n  Guidance: ${h.guidance_en}`,
  ).join('\n');

  return `Here are the 19 R-hypotheses (Responsibility markers) — each is binary 0/1:

${hypothesisList}

--- JOB DESCRIPTION ---
${jdText}
--- END JOB DESCRIPTION ---

Return JSON with all 19 activations.`;
}

function buildEUserPrompt(jdText: string): string {
  const hypothesisList = E_HYPOTHESES.map(
    (h) =>
      `- ${h.key}  (dim: ${h.dimension}, type: ${h.type})\n  Label: ${h.label_en}\n  Guidance: ${h.guidance_en}`,
  ).join('\n');

  return `Here are the 45 E-hypotheses (Effort markers) — each is binary 0/1:

${hypothesisList}

--- JOB DESCRIPTION ---
${jdText}
--- END JOB DESCRIPTION ---

Return JSON with all 45 activations.`;
}

// ---------------------------------------------------------------------------
// Types for captured response files
// ---------------------------------------------------------------------------

export interface CapturedExtraction {
  capturedAt: string;
  fixtureId: string;
  jobTitle: string;
  extraction: 'R' | 'E';
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  activations: Array<{ key: string; active: boolean; evidence: string | null }>;
  rawText: string;
}

export interface ManifestEntry {
  fixtureId: string;
  jobTitle: string;
  rCapturedAt: string | null;
  eCapturedAt: string | null;
  rError: string | null;
  eError: string | null;
}

export interface Manifest {
  version: string;
  createdAt: string;
  updatedAt: string;
  modelId: string;
  entries: ManifestEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function outPath(fixtureId: string, extraction: 'R' | 'E'): string {
  return path.resolve(OUT_DIR, `${fixtureId}.${extraction.toLowerCase()}-extract.json`);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function extractActivations(
  raw: string,
): Array<{ key: string; active: boolean; evidence: string | null }> | null {
  // Strip markdown code blocks if present
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  // Find first { to handle leading text
  const start = stripped.indexOf('{');
  if (start === -1) return null;

  try {
    const parsed = JSON.parse(stripped.slice(start)) as {
      activations?: Array<{ key: string; active: boolean; evidence: string | null }>;
    };
    return parsed.activations ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Core capture function
// ---------------------------------------------------------------------------

interface AnthropicApiResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message: string };
}

async function captureOne(
  apiKey: string,
  fixture: GoldenFixture,
  extraction: 'R' | 'E',
): Promise<CapturedExtraction | { error: string }> {
  const systemPrompt = extraction === 'R' ? R_SYSTEM_PROMPT : E_SYSTEM_PROMPT;
  const userPrompt =
    extraction === 'R'
      ? buildRUserPrompt(fixture.jd_text)
      : buildEUserPrompt(fixture.jd_text);

  if (DRY_RUN) {
    console.log(`[dry-run] ${fixture.id} ${extraction} — prompt length: ${userPrompt.length} chars`);
    return {
      capturedAt: new Date().toISOString(),
      fixtureId: fixture.id,
      jobTitle: fixture.job_title,
      extraction,
      modelId: MODEL_ID,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
      activations: [],
      rawText: '(dry-run)',
    };
  }

  const t0 = Date.now();
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL_ID,
        max_tokens: MAX_TOKENS,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const durationMs = Date.now() - t0;
    const json = (await res.json()) as AnthropicApiResponse;

    if (!res.ok) {
      return { error: `HTTP ${res.status}: ${json.error?.message ?? JSON.stringify(json)}` };
    }

    const rawText =
      (json.content ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('');

    const activations = extractActivations(rawText);
    if (!activations) {
      return { error: `Failed to parse activations from response: ${rawText.slice(0, 200)}` };
    }

    const expectedCount = extraction === 'R' ? 19 : 45;
    if (activations.length !== expectedCount) {
      console.warn(
        `  [warn] ${fixture.id} ${extraction}: got ${activations.length} activations, expected ${expectedCount}`,
      );
    }

    return {
      capturedAt: new Date().toISOString(),
      fixtureId: fixture.id,
      jobTitle: fixture.job_title,
      extraction,
      modelId: MODEL_ID,
      inputTokens: json.usage?.input_tokens ?? 0,
      outputTokens: json.usage?.output_tokens ?? 0,
      durationMs,
      activations,
      rawText,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // 1. Check API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !DRY_RUN) {
    console.error('[error] ANTHROPIC_API_KEY is not set. Export it before running this script.');
    process.exit(1);
  }

  // 2. Load fixtures
  const fixturePath = process.env.GOLDEN_FIXTURES_PATH ?? DEFAULT_FIXTURE_PATH;
  let fixtureFile: GoldenFixtureFile;
  try {
    const raw = await fs.readFile(path.resolve(fixturePath.replace('~', process.env.HOME ?? '')), 'utf-8');
    fixtureFile = JSON.parse(raw) as GoldenFixtureFile;
  } catch {
    console.error(`[error] Could not read fixture file at: ${fixturePath}`);
    console.error('  Set GOLDEN_FIXTURES_PATH or place file at ~/Desktop/jd-suite-golden/golden-jd-fixtures.json');
    process.exit(1);
  }

  let fixtures = fixtureFile.fixtures;
  if (fixtureFilter && fixtureFilter.length > 0) {
    fixtures = fixtures.filter((f) => fixtureFilter.includes(f.id));
    if (fixtures.length === 0) {
      console.error(`[error] No fixtures matched filter: ${fixtureFilter.join(', ')}`);
      process.exit(1);
    }
  }

  console.log(`[capture] ${DRY_RUN ? '(DRY RUN) ' : ''}Processing ${fixtures.length} fixture(s), 2 extractions each`);
  console.log(`[capture] Output dir: ${OUT_DIR}`);
  console.log(`[capture] Model: ${MODEL_ID}`);

  await fs.mkdir(OUT_DIR, { recursive: true });

  // 3. Load or init manifest
  let manifest: Manifest;
  if (await fileExists(MANIFEST_PATH)) {
    manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf-8')) as Manifest;
  } else {
    manifest = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      modelId: MODEL_ID,
      entries: [],
    };
  }

  // 4. Initialise manifest entries for fixtures we're about to process
  for (const fixture of fixtures) {
    if (!manifest.entries.find((e) => e.fixtureId === fixture.id)) {
      manifest.entries.push({
        fixtureId: fixture.id,
        jobTitle: fixture.job_title,
        rCapturedAt: null,
        eCapturedAt: null,
        rError: null,
        eError: null,
      });
    }
  }

  const resolvedKey = apiKey ?? 'dry-run-key';

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const fixture of fixtures) {
    const entry = manifest.entries.find((e) => e.fixtureId === fixture.id)!;

    for (const extraction of ['R', 'E'] as const) {
      const filePath = outPath(fixture.id, extraction);
      const alreadyExists = !FORCE && (await fileExists(filePath));

      if (alreadyExists) {
        console.log(`  [skip] ${fixture.id} ${extraction} — already captured (use --force to re-capture)`);
        skipCount++;
        continue;
      }

      console.log(`  [run]  ${fixture.id} ${extraction} — ${fixture.job_title}`);
      const result = await captureOne(resolvedKey, fixture, extraction);

      if ('error' in result) {
        console.error(`  [err]  ${fixture.id} ${extraction}: ${result.error}`);
        if (extraction === 'R') entry.rError = result.error;
        else entry.eError = result.error;
        errorCount++;
      } else {
        await fs.writeFile(filePath, JSON.stringify(result, null, 2), 'utf-8');
        if (extraction === 'R') {
          entry.rCapturedAt = result.capturedAt;
          entry.rError = null;
        } else {
          entry.eCapturedAt = result.capturedAt;
          entry.eError = null;
        }
        const activeCount = result.activations.filter((a) => a.active).length;
        console.log(
          `  [ok]   ${fixture.id} ${extraction} — ${activeCount} active, ${result.inputTokens}in/${result.outputTokens}out tokens, ${result.durationMs}ms`,
        );
        successCount++;
      }

      // Save manifest after each extraction so progress is preserved on failure
      manifest.updatedAt = new Date().toISOString();
      await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');

      if (!DRY_RUN && extraction !== 'E') {
        // Pause between R and E calls for same fixture
        await sleep(RATE_LIMIT_MS);
      }
    }

    if (!DRY_RUN && fixture !== fixtures[fixtures.length - 1]) {
      // Pause between fixtures
      await sleep(RATE_LIMIT_MS);
    }
  }

  console.log(`\n[capture] Done. success=${successCount} skip=${skipCount} error=${errorCount}`);
  if (errorCount > 0) {
    console.log('[capture] Re-run without --force to retry failed extractions only.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[capture] Fatal:', err);
  process.exit(1);
});
