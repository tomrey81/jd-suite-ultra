/**
 * G-7 Golden Test Harness — Phase 2 gate
 *
 * Runs the Axiomera R + E extraction + compose pipeline against 15 human-reviewed
 * JD fixtures and reports alignment with oracle (human) judgments.
 *
 * PURPOSE: Measurement, not pass/fail gate (yet). The harness produces a per-fixture
 * report showing where the engine agrees and diverges from human reviewers.
 * Thresholds will be tightened after real Claude fixture responses are captured.
 *
 * MOCK STRATEGY: callAi is mocked to return fixture-derived activations so the
 * test runs deterministically without hitting the Anthropic API.
 *
 * KNOWN GAPS (see docs/ultra/14-golden-fixtures-setup.md §4):
 *   1. MGMT assertion skipped — engine does not output mgmt flag
 *   2. 13 fixture hypothesis keys have no engine equivalent (see types.ts)
 *   3. E interaction markers default to false in mock (not in fixture)
 *   4. S defaults to 90 (S2) — no Edu/Exp declared in fixtures
 *   5. Grade/band comparison may diverge because oracle uses human judgment,
 *      engine uses weighted formula; harness REPORTS but does not fail on band
 *
 * SKIP BEHAVIOUR: if GOLDEN_FIXTURES_PATH is unset and the default local path
 * is unavailable, the entire suite is skipped with a console message. CI without
 * fixtures configured will not fail.
 */

import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { GoldenFixture } from '@/lib/golden/types';
import { loadGoldenFixtures } from '@/lib/golden/fetch-fixtures';
import { buildRMockResponse, buildEMockResponse } from '@/lib/golden/claude-mock';
import { extractR } from './extract-r';
import { extractE } from './extract-e';
import { computeGrade, gradeToBand } from './compose';

// ---------------------------------------------------------------------------
// Mock callAi — intercept at module level, parameterize per test
// ---------------------------------------------------------------------------

// Holds the current fixture for the mock to reference
let _currentFixture: GoldenFixture | null = null;

vi.mock('@/lib/ai/call-ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/call-ai')>();
  return {
    ...actual,
    callAi: vi.fn(async ({ operation }: { operation: string }) => {
      if (!_currentFixture) throw new Error('[golden mock] No fixture set — call setFixture() before extractR/extractE');
      if (operation === 'jd.axiomera.extractR') return buildRMockResponse(_currentFixture);
      if (operation === 'jd.axiomera.extractE') return buildEMockResponse(_currentFixture);
      return { text: '{}', inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, durationMs: 0, cacheStatus: 'miss' };
    }),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip AX-prefix from oracle grade_level e.g. "AX3/B1" → "B1", "AX9/E" → "E" */
function oracleBand(gradeLevelStr: string): string {
  return gradeLevelStr.includes('/') ? gradeLevelStr.split('/')[1] : gradeLevelStr;
}

/** Lenient band comparison: exact match OR oracle is prefix of engine band (e.g. "E" matches "E1") */
function bandsAlign(engineBand: string, oracleBandStr: string): boolean {
  return engineBand === oracleBandStr || engineBand.startsWith(oracleBandStr);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('G-7 Golden test harness', () => {
  let fixtures: GoldenFixture[] = [];

  // Per-fixture result accumulator for summary report
  const report: Array<{
    id: string;
    title: string;
    zoneHuman: number;
    zoneEngine: number;
    zoneMatch: boolean;
    oracleBand: string;
    engineBand: string;
    bandMatch: boolean;
    rActiveCount: number;
    eActiveCount: number;
    borderline: boolean;
  }> = [];

  beforeAll(async () => {
    const file = await loadGoldenFixtures();
    if (!file) {
      console.warn(
        '\n[golden] Fixtures not available — set GOLDEN_FIXTURES_PATH or place file at' +
        '\n  ~/Desktop/jd-suite-golden/golden-jd-fixtures.json' +
        '\n  All golden tests will be skipped.\n',
      );
      return;
    }
    fixtures = file.fixtures;
    console.info(`\n[golden] Loaded ${fixtures.length} fixtures (v${file.version})`);
  });

  afterAll(() => {
    if (report.length === 0) return;

    const zoneMatches = report.filter((r) => r.zoneMatch).length;
    const bandMatches = report.filter((r) => r.bandMatch).length;
    const borderlineCount = report.filter((r) => r.borderline).length;

    console.info('\n╔══════════════════════════════════════════════════════════════════╗');
    console.info('║              G-7 BASELINE REPORT — engine vs oracle             ║');
    console.info('╠══════════════════════════════════════════════════════════════════╣');
    console.info(`║  Zone match:  ${zoneMatches}/${report.length} (${Math.round(zoneMatches/report.length*100)}%)  Band match: ${bandMatches}/${report.length} (${Math.round(bandMatches/report.length*100)}%)        ║`);
    console.info(`║  Borderline fixtures: ${borderlineCount} (zone match in these counts separately)  ║`);
    console.info('╠══════════════════════════════════════════════════════════════════╣');
    console.info('║  ID    Title                         Z↑  Ze  Band↑ Bande  Match ║');
    for (const r of report) {
      const title = r.title.slice(0, 28).padEnd(28);
      const zMatch = r.zoneMatch ? '✓' : '✗';
      const bMatch = r.bandMatch ? '✓' : '✗';
      console.info(
        `║  ${r.id}  ${title}  ${r.zoneHuman}   ${r.zoneEngine}  ${r.oracleBand.padEnd(4)}  ${r.engineBand.padEnd(4)}   ${zMatch}${bMatch}  ║`,
      );
    }
    console.info('╚══════════════════════════════════════════════════════════════════╝\n');
  });

  it('loads all 15 fixtures', () => {
    if (fixtures.length === 0) {
      console.warn('[golden] Skipping: no fixtures loaded');
      return;
    }
    expect(fixtures).toHaveLength(15);
    expect(fixtures[0].id).toBe('G-01');
    expect(fixtures[14].id).toBe('G-15');
  });

  // Generate one sub-test per fixture
  const fixtureRunner = async (fixture: GoldenFixture) => {
    _currentFixture = fixture;

    const rResult = await extractR(fixture.jd_text);
    const eResult = await extractE(fixture.jd_text);

    // S defaults to 90 (S2) — no Edu/Exp declared in fixtures
    const S_DEFAULT = 90;
    const grade = computeGrade(rResult.r_points, S_DEFAULT, eResult.e_pkt);
    const band = gradeToBand(grade);
    const expectedBand = oracleBand(fixture.expected_grades.oracle_consensus.grade_level);

    const zoneMatch = rResult.rounded_zone === fixture.zone_human;
    const bandMatch = bandsAlign(band, expectedBand);

    // Accumulate for summary report
    report.push({
      id: fixture.id,
      title: fixture.job_title,
      zoneHuman: fixture.zone_human,
      zoneEngine: rResult.rounded_zone,
      zoneMatch,
      oracleBand: expectedBand,
      engineBand: band,
      bandMatch,
      rActiveCount: rResult.active_keys.length,
      eActiveCount: eResult.active_keys.length,
      borderline: fixture.borderline,
    });

    // --- ASSERTIONS ---

    // Zone: primary truth. Expect exact match or log divergence with context.
    expect(
      rResult.rounded_zone,
      `Zone mismatch for ${fixture.id} (${fixture.job_title}): engine=${rResult.rounded_zone}, oracle=${fixture.zone_human} [borderline=${fixture.borderline}]`,
    ).toBe(fixture.zone_human);

    // Active R keys: engine should activate at least the fixture's true R keys
    const expectedRActive = Object.entries(fixture.expected_hypotheses)
      .filter(([k, v]) => k.startsWith('hypo_') && v === true)
      .map(([k]) => k.replace('hypo_', ''))
      .filter((k) => rResult.active_keys.includes(k) || true); // count fixture-true R keys
    const fixtureRTrueKeys = Object.entries(fixture.expected_hypotheses)
      .filter(([k, v]) => k.startsWith('hypo_') && v === true)
      .map(([k]) => k.replace('hypo_', ''))
      .filter((k) => ['no_prior_experience','little_discretion','close_supervision','confirms_task_steps','structured_assignments','follows_verbal_written_instructions','structured_environment','solves_recurring_problems','determines_escalation','general_direction','coordinates_team_work','impact_beyond_team','drives_professional_development_others','develops_professional_network','influences_industry','org_wide_impact','member_executive_committee','reports_to_board','sets_enterprise_vision'].includes(k));

    // All fixture-true R keys should be active in engine result
    for (const key of fixtureRTrueKeys) {
      expect(
        rResult.active_keys,
        `R key "${key}" should be active in ${fixture.id} (${fixture.job_title})`,
      ).toContain(key);
    }

    // Band: lenient comparison (logs in report, soft assertion)
    // Use expect.soft equivalent via try/catch + report — band is logged, not hard failure
    // (tighten once real Claude fixtures are captured)
    if (!bandMatch) {
      console.warn(
        `[golden] ${fixture.id} band divergence: engine="${band}", oracle="${expectedBand}" (grade=${grade})`,
      );
    }

    // MGMT: skipped — engine does not output mgmt flag (gap documented in 14-golden-fixtures-setup.md)
  };

  // Register individual fixture tests so vitest shows per-fixture results
  describe.each([
    ['G-01'], ['G-02'], ['G-03'], ['G-04'], ['G-05'],
    ['G-06'], ['G-07'], ['G-08'], ['G-09'], ['G-10'],
    ['G-11'], ['G-12'], ['G-13'], ['G-14'], ['G-15'],
  ])('%s', (id) => {
    it(`runs pipeline for ${id}`, async () => {
      if (fixtures.length === 0) {
        console.warn(`[golden] Skipping ${id}: no fixtures loaded`);
        return;
      }
      const fixture = fixtures.find((f) => f.id === id);
      if (!fixture) {
        throw new Error(`Fixture ${id} not found in loaded file`);
      }
      await fixtureRunner(fixture);
    });
  });
});
