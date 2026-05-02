# Golden Claude Fixtures

**Status:** Generated locally, not committed (gitignored)
**Populated by:** `apps/web/scripts/capture-golden-claude-responses.ts`
**Upload to:** GDrive alongside `golden-jd-fixtures.json`

## Contents

This directory holds captured real Claude responses for the 15 golden JD fixtures.
Files are gitignored because they contain confidential JD analysis.

| File pattern | Contents |
|---|---|
| `G-{01..15}.r-extract.json` | Claude's R-hypothesis activations (19 markers) |
| `G-{01..15}.e-extract.json` | Claude's E-hypothesis activations (45 markers) |
| `manifest.json` | Capture timestamps, model ID, token counts |

## File schema

### `G-XX.r-extract.json` / `G-XX.e-extract.json`

```ts
{
  capturedAt: string;          // ISO timestamp
  fixtureId: string;           // e.g. "G-01"
  jobTitle: string;
  extraction: "R" | "E";
  modelId: string;             // e.g. "claude-sonnet-4-6"
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  activations: Array<{
    key: string;               // hypothesis key
    active: boolean;
    evidence: string | null;   // verbatim quote from JD, or null
  }>;
  rawText: string;             // raw Claude response text
}
```

## Regenerating

```bash
cd apps/web
ANTHROPIC_API_KEY=sk-ant-... \
GOLDEN_FIXTURES_PATH=~/Desktop/jd-suite-golden/golden-jd-fixtures.json \
  npx tsx scripts/capture-golden-claude-responses.ts

# Re-capture a single fixture:
npx tsx scripts/capture-golden-claude-responses.ts --fixture G-07

# Force re-capture (overwrite existing):
npx tsx scripts/capture-golden-claude-responses.ts --force

# Dry run (no API calls):
npx tsx scripts/capture-golden-claude-responses.ts --dry-run
```

## How the mock uses these files

`apps/web/lib/golden/claude-mock.ts` checks for captured files at runtime.
If a file exists, `buildRMockResponse` / `buildEMockResponse` return the
captured activations instead of deriving from fixture boolean flags.
This makes golden tests exercise the real Claude activation patterns.
