/**
 * Source connector registry.
 *
 * Connectors are tried in priority order for a given input URL.
 * Priority 1 = official APIs → Priority 2 = schema.org → Priority 3 = HTML fallback.
 *
 * To add a new connector:
 * 1. Create it in lib/sources/connectors/
 * 2. Import and add it to CONNECTORS (in the right priority position)
 */

import type { SourceConnector, SourceKind } from './types';
import { GreenhouseConnector } from './connectors/greenhouse';
import { AshbyConnector } from './connectors/ashby';
import { LeverConnector } from './connectors/lever';
import { SmartRecruitersConnector } from './connectors/smartrecruiters';
import { AdzunaConnector } from './connectors/adzuna';
import { SchemaOrgConnector } from './connectors/schema-org';
import { GenericHtmlConnector } from './connectors/generic-html';

// Priority-ordered list. First matching connector wins for auto-detection.
const CONNECTORS: SourceConnector[] = [
  // Priority 1 — Official APIs
  new GreenhouseConnector(),
  new AshbyConnector(),
  new LeverConnector(),
  new SmartRecruitersConnector(),
  new AdzunaConnector(),
  // Priority 2 — Structured data
  new SchemaOrgConnector(),
  // Priority 3 — HTML fallback (always last)
  new GenericHtmlConnector(),
];

/** Auto-detect the best connector for a given input. */
export function detectConnector(input: string): SourceConnector | null {
  for (const c of CONNECTORS) {
    if (c.id !== 'generic-html' && c.canHandle(input)) return c;
  }
  // Fall back to schema-org first, then generic-html for bare URLs
  if (/^https?:\/\//i.test(input)) return getConnector('schema-org')!;
  return null;
}

/** Get a connector by its id. */
export function getConnector(id: string): SourceConnector | null {
  return CONNECTORS.find((c) => c.id === id) ?? null;
}

/** Get all registered connectors. */
export function getAllConnectors(): SourceConnector[] {
  return [...CONNECTORS];
}

/** Map from SourceKind to the primary connector that handles it. */
export function getConnectorForKind(kind: SourceKind): SourceConnector | null {
  return CONNECTORS.find((c) => c.sourceKind === kind) ?? null;
}

/** Connector metadata for UI display. */
export interface ConnectorMeta {
  id: string;
  name: string;
  sourceKind: SourceKind;
  priority: 'api' | 'structured' | 'html' | 'aggregator';
  description: string;
  requiresApiKey: boolean;
  complianceNote: string;
}

export const CONNECTOR_META: ConnectorMeta[] = [
  {
    id: 'greenhouse',
    name: 'Greenhouse Job Board API',
    sourceKind: 'GREENHOUSE_API',
    priority: 'api',
    description: 'Public JSON API. Returns structured job data including departments, locations, and full descriptions.',
    requiresApiKey: false,
    complianceNote: 'Official public API. No authentication required for published jobs.',
  },
  {
    id: 'ashby',
    name: 'Ashby Posting API',
    sourceKind: 'ASHBY_POSTING_API',
    priority: 'api',
    description: 'Public JSON API. Returns departments, teams, locations, and optionally salary ranges.',
    requiresApiKey: false,
    complianceNote: 'Official public API. No authentication required for listed jobs.',
  },
  {
    id: 'lever',
    name: 'Lever Postings API',
    sourceKind: 'LEVER_POSTINGS_API',
    priority: 'api',
    description: 'Public JSON API. Returns structured job data with department, team, location, and salary ranges.',
    requiresApiKey: false,
    complianceNote: 'Official public API. No authentication required for published jobs.',
  },
  {
    id: 'smartrecruiters',
    name: 'SmartRecruiters Posting API',
    sourceKind: 'SMARTRECRUITERS_POSTING_API',
    priority: 'api',
    description: 'Public Posting API. Returns departments, locations, experience levels, compensation, and full descriptions.',
    requiresApiKey: false,
    complianceNote: 'Official public API. No authentication required for listed jobs.',
  },
  {
    id: 'adzuna',
    name: 'Adzuna Job Board API',
    sourceKind: 'ADZUNA_API',
    priority: 'aggregator',
    description: 'Aggregator search API. Useful for market discovery and salary signals. Descriptions may be snippets.',
    requiresApiKey: true,
    complianceNote: 'Official API. Requires ADZUNA_APP_ID and ADZUNA_APP_KEY.',
  },
  {
    id: 'schema-org',
    name: 'schema.org JobPosting Parser',
    sourceKind: 'GENERIC_SCHEMA_ORG',
    priority: 'structured',
    description: 'Extracts JSON-LD JobPosting markup from any public web page. Higher accuracy than HTML scraping.',
    requiresApiKey: false,
    complianceNote: 'Reads publicly available structured metadata.',
  },
  {
    id: 'generic-html',
    name: 'Generic HTML (AI-extracted)',
    sourceKind: 'GENERIC_PUBLIC_HTML',
    priority: 'html',
    description: 'AI-powered fallback for sites without APIs or structured data. Stops on CAPTCHA/login/robots disallow.',
    requiresApiKey: false,
    complianceNote: 'Only accesses public pages. Stops on any access restriction.',
  },
];
