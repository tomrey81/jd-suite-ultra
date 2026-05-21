# JD Suite Ultra — ATS Connector Guide

> Last updated: 2026-05-10
> For: developers adding new job source connectors

---

## Overview

Job sources are integrations with ATS platforms and job boards that import postings into JD Suite Ultra. All connectors share a common interface and are registered in `lib/sources/registry.ts`.

---

## Current Connectors

| ID | Name | Type | Auth |
|----|------|------|------|
| `greenhouse` | Greenhouse | Official API | API key |
| `ashby` | Ashby | Posting API | API key |
| `lever` | Lever | Official API | API key |
| `smartrecruiters` | SmartRecruiters | Official API | API key |
| `adzuna` | Adzuna | Search API | App ID + key |
| `schema-org` | Schema.org JSON-LD | HTML parsing | None |
| `generic-html` | Generic HTML | HTML scraping | None |

### Missing Major ATS (roadmap)

| Platform | Market Share (EMEA) | Priority |
|----------|-------------------|---------|
| Workday | Very high (enterprise) | High |
| SAP SuccessFactors | High (enterprise) | High |
| Personio | High (SMB) | High |
| Recruitee | Medium (EU-first) | Medium |
| iCIMS | Medium (enterprise) | Medium |
| Taleo (Oracle) | Medium (legacy enterprise) | Low |

---

## Connector Interface

All connectors implement `SourceConnector` from `lib/sources/types.ts`:

```typescript
interface SourceConnector {
  /** Unique string ID — used in SourceConnection.kind */
  id: string;

  /** Display name for UI */
  name: string;

  /** Determines which SourceKind enum value this connector handles */
  sourceKind: SourceKind;

  /** Returns true if this connector can handle the given input (URL or config) */
  canHandle(input: string): boolean;

  /** Test auth credentials — returns success/failure + error message */
  preflight(config: ConnectorConfig): Promise<PreflightResult>;

  /** Discover available job postings */
  discover(config: ConnectorConfig): Promise<DiscoveredJob[]>;

  /** Fetch full posting details for a discovered job */
  fetch(job: DiscoveredJob, config: ConnectorConfig): Promise<NormalisedPosting>;
}
```

### NormalisedPosting Shape

```typescript
interface NormalisedPosting {
  externalId: string;
  title: string;
  department?: string;
  jobFamily?: string;
  salary?: { min?: number; max?: number; currency: string; period: 'annual' | 'monthly' | 'hourly' };
  location?: string;
  descriptionRaw: string;     // Original HTML or text
  descriptionClean?: string;  // Stripped plain text (for AI processing)
  contentHash?: string;       // SHA-256 of descriptionClean for dedup
  postedAt?: Date;
  closingAt?: Date;
  url?: string;
}
```

---

## Adding a New Connector

### Step 1: Create the Connector File

```typescript
// apps/web/lib/sources/connectors/my-ats.ts

import type { SourceConnector, ConnectorConfig, PreflightResult, DiscoveredJob, NormalisedPosting } from '../types';
import { sha256 } from '../utils';

export class MyAtsConnector implements SourceConnector {
  id = 'my-ats';
  name = 'My ATS';
  sourceKind = 'MY_ATS_API' as const;

  canHandle(input: string): boolean {
    return /my-ats\.io/.test(input);
  }

  async preflight(config: ConnectorConfig): Promise<PreflightResult> {
    const res = await fetch(`https://api.my-ats.io/v1/ping`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `HTTP ${res.status}: ${await res.text()}` };
  }

  async discover(config: ConnectorConfig): Promise<DiscoveredJob[]> {
    const res = await fetch(`https://api.my-ats.io/v1/jobs`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    const data = await res.json();
    return data.jobs.map((j: any) => ({ externalId: j.id, title: j.title, url: j.url }));
  }

  async fetch(job: DiscoveredJob, config: ConnectorConfig): Promise<NormalisedPosting> {
    const res = await fetch(`https://api.my-ats.io/v1/jobs/${job.externalId}`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    const data = await res.json();
    const descriptionClean = stripHtml(data.description);
    return {
      externalId: data.id,
      title: data.title,
      department: data.department,
      location: data.location?.name,
      descriptionRaw: data.description,
      descriptionClean,
      contentHash: sha256(descriptionClean),
    };
  }
}
```

### Step 2: Add SourceKind to Schema

```prisma
// packages/db/prisma/schema.prisma
// In SourceConnection.kind field, update the documented allowed values:
// "GREENHOUSE_API" | "ASHBY_POSTING_API" | ... | "MY_ATS_API"
```

Run: `pnpm db:migrate:dev --name add-my-ats-source-kind`

### Step 3: Register in Registry

```typescript
// apps/web/lib/sources/registry.ts

import { MyAtsConnector } from './connectors/my-ats';

const CONNECTORS: SourceConnector[] = [
  new GreenhouseConnector(),
  new AshbyConnector(),
  new LeverConnector(),
  new SmartRecruitersConnector(),
  new MyAtsConnector(),        // ← Add here in priority order
  new AdzunaConnector(),
  new SchemaOrgConnector(),
  new GenericHtmlConnector(),  // Always last
];
```

### Step 4: Add Auth Config Shape

If the connector requires credentials, document the expected `ConnectorConfig` fields and update the `/sources` UI form.

### Step 5: Write Tests

```typescript
// apps/web/lib/sources/connectors/__tests__/my-ats.test.ts

import { describe, it, expect, vi } from 'vitest';
import { MyAtsConnector } from '../my-ats';

describe('MyAtsConnector', () => {
  it('canHandle() matches my-ats.io URLs', () => {
    const c = new MyAtsConnector();
    expect(c.canHandle('https://api.my-ats.io/v1/jobs')).toBe(true);
    expect(c.canHandle('https://greenhouse.io')).toBe(false);
  });

  it('normalises posting correctly', async () => {
    // Mock fetch + test normalisation
  });
});
```

---

## Priority Routing Logic

```
Input URL
   ↓
detectConnector(input)
   ↓ iterates CONNECTORS in order
   ↓ first connector where canHandle(input) = true wins
   ↓ exception: generic-html is always skipped in auto-detection
   ↓
If no match: schema-org for https:// URLs, null otherwise
```

**Known gap**: Schema.org fires for ALL `https://` URLs including non-job-posting pages. Consider adding a `schema-org` content-type check before falling back.

---

## Connector Config Storage

Connector auth config (API keys etc.) is stored in `SourceConnection.config` as an encrypted JSON blob in Neon. Never log or return this config to the client — only return `{ id, name, kind, lastSyncAt }` metadata.

---

## Testing a Connector

Use the preflight endpoint to test credentials without running a full sync:

```bash
POST /api/sources/preflight
{
  "sourceConnectionId": "..."
}
```

Response:
```json
{ "ok": true }
// or
{ "ok": false, "error": "HTTP 401: Invalid API key" }
```
