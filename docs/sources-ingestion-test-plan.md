# Sources Ingestion — Test Plan

> Version: 1.0 · 2026-05-03

---

## Unit Tests

### 1. Connector Classification

```typescript
// lib/sources/registry.test.ts
describe('detectConnector', () => {
  it('detects Greenhouse from URL', () => {
    const c = detectConnector('https://boards.greenhouse.io/acme');
    expect(c?.id).toBe('greenhouse');
  });
  it('detects Ashby from URL', () => {
    const c = detectConnector('https://jobs.ashbyhq.com/acme');
    expect(c?.id).toBe('ashby');
  });
  it('falls back to schema-org for generic URL', () => {
    const c = detectConnector('https://careers.example.com');
    expect(c?.id).toBe('schema-org');
  });
  it('returns null for non-URL without matching connector', () => {
    const c = detectConnector('not-a-url');
    expect(c).toBeNull();
  });
});
```

### 2. schema.org JSON-LD Parser

```typescript
// lib/sources/connectors/schema-org.test.ts
describe('parseSchemaOrgJobPostings', () => {
  it('extracts single JobPosting', () => {
    const html = `<script type="application/ld+json">
      {"@type":"JobPosting","title":"Engineer","description":"Build stuff",
       "hiringOrganization":{"name":"Acme"},"datePosted":"2026-05-01"}
    </script>`;
    const jobs = parseSchemaOrgJobPostings(html, 'https://acme.com/jobs/1');
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe('Engineer');
    expect(jobs[0].companyName).toBe('Acme');
  });

  it('extracts from @graph array', () => {
    const html = `<script type="application/ld+json">
      {"@graph":[{"@type":"JobPosting","title":"Designer"},{"@type":"Organization","name":"Acme"}]}
    </script>`;
    const jobs = parseSchemaOrgJobPostings(html, 'https://acme.com');
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe('Designer');
  });

  it('returns empty array for no JobPosting markup', () => {
    const jobs = parseSchemaOrgJobPostings('<html><body>No jobs</body></html>', 'https://acme.com');
    expect(jobs).toHaveLength(0);
  });

  it('parses baseSalary with min/max', () => {
    const html = `<script type="application/ld+json">
      {"@type":"JobPosting","title":"PM",
       "baseSalary":{"@type":"MonetaryAmount","currency":"GBP",
         "value":{"@type":"QuantitativeValue","minValue":60000,"maxValue":80000,"unitText":"YEAR"}}}
    </script>`;
    const [job] = parseSchemaOrgJobPostings(html, 'https://x.com');
    expect(job.salaryMin).toBe(60000);
    expect(job.salaryMax).toBe(80000);
    expect(job.salaryCurrency).toBe('GBP');
    expect(job.salaryPeriod).toBe('YEAR');
  });

  it('detects remote working from TELECOMMUTE', () => {
    const html = `<script type="application/ld+json">
      {"@type":"JobPosting","title":"Dev","jobLocationType":"TELECOMMUTE"}
    </script>`;
    const [job] = parseSchemaOrgJobPostings(html, 'https://x.com');
    expect(job.workingModel).toBe('Remote');
  });
});
```

### 3. Adzuna Response Normalisation

```typescript
// lib/sources/connectors/adzuna.test.ts
describe('AdzunaConnector.normalize', () => {
  const mockJob = {
    id: 'abc123',
    title: 'Data Analyst',
    description: 'Short snippet...',
    redirect_url: 'https://example.com/jobs/1',
    created: '2026-04-28T12:00:00Z',
    company: { display_name: 'DataCorp' },
    location: { display_name: 'London, UK', area: ['UK'] },
    salary_min: 45000,
    salary_max: 60000,
    salary_is_predicted: '0',
    contract_type: 'permanent',
  };

  it('maps all standard fields', async () => {
    const connector = new AdzunaConnector();
    const ref: RawPostingReference = {
      externalId: 'abc123', title: 'Data Analyst',
      url: 'https://example.com/jobs/1', location: 'London, UK',
      department: null, team: null, datePosted: '2026-04-28T12:00:00Z',
      dateSeen: '2026-05-01', rawMetadata: mockJob,
    };
    const { posting } = await connector.normalize(ref, { html: null, json: mockJob, diagnostics: ok() });
    expect(posting.title).toBe('Data Analyst');
    expect(posting.salaryMin).toBe(45000);
    expect(posting.salaryMax).toBe(60000);
    expect(posting.sourceKind).toBe('ADZUNA_API');
  });

  it('flags snippet-only descriptions with PARTIAL_EXTRACTION', async () => {
    const connector = new AdzunaConnector();
    const ref = { ...minRef, rawMetadata: { ...mockJob, description: 'Short.' } };
    const { diagnostics } = await connector.normalize(ref, { html: null, json: ref.rawMetadata, diagnostics: ok() });
    expect(diagnostics.status).toBe('PARTIAL_EXTRACTION');
  });
});
```

### 4. Diagnostics Classification

```typescript
// lib/sources/diagnostics.test.ts
describe('classifyHttpError', () => {
  it('classifies 403 as LOGIN_REQUIRED', () => {
    const d = classifyHttpError(403);
    expect(d.status).toBe('LOGIN_REQUIRED');
    expect(d.authRequired).toBe(true);
  });
  it('classifies 403 with captcha text as CAPTCHA_OR_BOT_CHALLENGE', () => {
    const d = classifyHttpError(403, 'cf-challenge captcha');
    expect(d.status).toBe('CAPTCHA_OR_BOT_CHALLENGE');
    expect(d.captchaDetected).toBe(true);
  });
  it('classifies 429 as RATE_LIMITED', () => {
    const d = classifyHttpError(429);
    expect(d.status).toBe('RATE_LIMITED');
    expect(d.rateLimited).toBe(true);
  });
  it('classifies 999 as LOGIN_REQUIRED (LinkedIn)', () => {
    const d = classifyHttpError(999);
    expect(d.status).toBe('LOGIN_REQUIRED');
    expect(d.userActionNeeded).toContain('prohibits');
  });
});
```

### 5. JD Readiness Quick Score

```typescript
// lib/sources/jd-readiness.test.ts
describe('quickReadinessScore', () => {
  it('returns 0 for empty description', () => {
    expect(quickReadinessScore('')).toBe(0);
  });
  it('returns 0 for very short description', () => {
    expect(quickReadinessScore('This is a job.')).toBe(0);
  });
  it('scores higher with explicit reporting line', () => {
    const desc = 'A'.repeat(600) + ' Reports to the VP of Engineering.';
    expect(quickReadinessScore(desc)).toBeGreaterThan(15);
  });
  it('scores higher with decision rights', () => {
    const desc = 'A'.repeat(600) + ' Budget authority up to £500k. Approval required for headcount.';
    expect(quickReadinessScore(desc)).toBeGreaterThan(20);
  });
  it('max score is 100', () => {
    const richDesc = 'A'.repeat(3500) + ' Reports to CEO. Budget £1M. Responsible for 5 FTEs. Decision rights for hiring. Required: 10y experience.';
    expect(quickReadinessScore(richDesc)).toBeLessThanOrEqual(100);
  });
});
```

### 6. Content Hash Deduplication

```typescript
// lib/sources/connectors/greenhouse.test.ts
describe('content hash', () => {
  it('produces identical hash for same content', () => {
    // Two separate normalizations of identical data should produce the same hash
    const hash1 = /* normalize posting A */;
    const hash2 = /* normalize posting B (same URL + title + description) */;
    expect(hash1).toBe(hash2);
  });
  it('produces different hash for different content', () => {
    const hash1 = /* posting with description "Build APIs" */;
    const hash2 = /* posting with description "Build pipelines" */;
    expect(hash1).not.toBe(hash2);
  });
});
```

---

## Integration Tests

### Mock Greenhouse Board

```typescript
// tests/integration/greenhouse.test.ts
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('https://boards-api.greenhouse.io/v1/boards/acme/jobs', () =>
    HttpResponse.json({
      jobs: [
        {
          id: 1001, title: 'Software Engineer', updated_at: '2026-05-01T00:00:00Z',
          location: { name: 'London' }, departments: [{ id: 1, name: 'Engineering' }],
          absolute_url: 'https://boards.greenhouse.io/acme/jobs/1001',
        }
      ]
    })
  )
);

describe('GreenhouseConnector.discover', () => {
  it('returns postings from mock board', async () => {
    const result = await new GreenhouseConnector().discover('acme');
    expect(result.postings).toHaveLength(1);
    expect(result.postings[0].title).toBe('Software Engineer');
    expect(result.postings[0].department).toBe('Engineering');
    expect(result.diagnostics.status).toBe('OK');
  });
});
```

### Mock Ashby Board

Similar pattern: mock `POST https://api.ashbyhq.com/posting-api/job-board` response.

### Mock Blocked Page (login required)

```typescript
describe('SchemaOrgConnector preflight', () => {
  it('returns LOGIN_REQUIRED for 403', async () => {
    server.use(http.get('https://example.com/jobs', () => new HttpResponse(null, { status: 403 })));
    const diag = await new SchemaOrgConnector().preflight('https://example.com/jobs');
    expect(diag.status).toBe('LOGIN_REQUIRED');
    expect(diag.userActionNeeded).toBeTruthy();
  });
});
```

### Mock CAPTCHA Page

```typescript
it('returns CAPTCHA_OR_BOT_CHALLENGE for captcha HTML', async () => {
  server.use(http.get('https://blocked.com', () =>
    HttpResponse.html('<html><body>captcha hcaptcha required</body></html>')
  ));
  const diag = await new GenericHtmlConnector().preflight('https://blocked.com');
  expect(diag.status).toBe('CAPTCHA_OR_BOT_CHALLENGE');
  expect(diag.captchaDetected).toBe(true);
});
```

### Mock Empty Board

```typescript
it('returns NO_JOBS_FOUND for empty results', async () => {
  server.use(http.get('.../jobs', () => HttpResponse.json({ jobs: [] })));
  const result = await new GreenhouseConnector().discover('empty-co');
  expect(result.postings).toHaveLength(0);
});
```

---

## E2E Tests (Playwright)

```typescript
// tests/e2e/sources.test.ts
test('sources page loads for authenticated user', async ({ page }) => {
  await page.goto('/sources');
  await expect(page.locator('h1')).toContainText('Source');
});

test('preflight detects Greenhouse URL', async ({ page }) => {
  await page.goto('/sources');
  await page.fill('[data-testid="source-input"]', 'https://boards.greenhouse.io/testcompany');
  await page.click('[data-testid="preflight-btn"]');
  await expect(page.locator('[data-testid="connector-detected"]')).toContainText('Greenhouse');
});

test('shows diagnostic on 403 blocked site', async ({ page }) => {
  // Mock: intercept API call
  await page.route('**/api/sources/preflight', (route) =>
    route.fulfill({ json: { ok: true, diagnostics: { status: 'LOGIN_REQUIRED', ... } } })
  );
  await page.goto('/sources');
  await page.fill('[data-testid="source-input"]', 'https://blocked.example.com');
  await page.click('[data-testid="preflight-btn"]');
  await expect(page.locator('[data-testid="diagnostic-status"]')).toContainText('LOGIN_REQUIRED');
});
```

---

## Smoke Tests

| Test | Expected |
|------|---------|
| `/sources` loads without auth | Redirect to login |
| `/sources` loads with auth | Page renders with connector list |
| `GET /api/sources/preflight` | Returns list of connectors |
| `POST /api/sources/preflight` with Greenhouse URL | Returns `connectorId: "greenhouse"` |
| `POST /api/sources/discover` with no `input` | Returns 400 |
| `POST /api/sources/analyse-readiness` with no `description` | Returns 400 |
| Adzuna search with missing API key | Returns `API_KEY_REQUIRED` diagnostic |
| schema.org parser on page with no JSON-LD | Returns `NO_JOBS_FOUND` |

---

## Quality Gates

- [ ] TypeScript strict mode: `tsc --noEmit` passes
- [ ] No untyped `any` in connector core logic
- [ ] All external HTTP boundaries have error handling
- [ ] `diagnostics.status` always set in every code path
- [ ] Build passes: `pnpm --filter web build`
- [ ] Smoke tests green
- [ ] No secrets or API keys in client bundle
