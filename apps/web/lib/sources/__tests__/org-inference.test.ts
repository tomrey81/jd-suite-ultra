/**
 * Unit tests — Org Structure Inference (Phase 9)
 * Run with: pnpm --filter web exec jest lib/sources/__tests__/org-inference.test.ts
 */

import { inferOrgStructure } from '../org-inference';
import type { NormalizedJobPosting } from '../types';

function makePosting(overrides: Partial<NormalizedJobPosting> = {}): NormalizedJobPosting {
  return {
    externalId: null,
    canonicalUrl: 'https://example.com/job/1',
    sourceUrl: 'https://example.com/job/1',
    companyName: 'Acme Corp',
    title: 'Software Engineer',
    normalizedTitle: null,
    department: null,
    subDepartment: null,
    team: null,
    jobFamily: null,
    jobLevel: null,
    employmentType: null,
    contractType: null,
    workingModel: null,
    location: null,
    country: null,
    language: 'en',
    datePosted: null,
    dateFirstSeen: new Date().toISOString(),
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    salarySource: null,
    descriptionRaw: 'A software engineer role.',
    descriptionClean: '',
    applicationUrl: null,
    contentHash: 'hash123',
    sourceKind: 'GENERIC_PUBLIC_HTML',
    confidenceScore: 70,
    ...overrides,
  };
}

describe('inferOrgStructure', () => {
  it('returns correct shape', () => {
    const result = inferOrgStructure([], []);
    expect(result).toHaveProperty('disclaimer');
    expect(result).toHaveProperty('nodes');
    expect(result).toHaveProperty('edges');
    expect(result).toHaveProperty('unresolvedSignals');
    expect(result).toHaveProperty('conflicts');
    expect(result).toHaveProperty('stats');
  });

  it('creates department nodes from postings', () => {
    const postings = [
      makePosting({ department: 'Engineering', title: 'Senior Engineer' }),
      makePosting({ department: 'Engineering', title: 'Junior Engineer' }),
      makePosting({ department: 'Marketing', title: 'Marketing Manager' }),
    ];
    const result = inferOrgStructure(postings, []);
    const depts = result.nodes.filter((n) => n.type === 'department');
    expect(depts.length).toBe(2);
    expect(depts.map((d) => d.normalizedLabel)).toContain('engineering');
    expect(depts.map((d) => d.normalizedLabel)).toContain('marketing');
  });

  it('deduplicates same department from multiple postings', () => {
    const postings = [
      makePosting({ department: 'Engineering' }),
      makePosting({ department: 'Engineering' }),
      makePosting({ department: 'Engineering' }),
    ];
    const result = inferOrgStructure(postings, []);
    const depts = result.nodes.filter((n) => n.type === 'department');
    expect(depts.length).toBe(1);
    expect(depts[0].jobCount).toBe(3);
  });

  it('creates team nodes and edges from postings', () => {
    const postings = [
      makePosting({ department: 'Engineering', team: 'Platform' }),
    ];
    const result = inferOrgStructure(postings, []);
    const teams = result.nodes.filter((n) => n.type === 'team');
    expect(teams.length).toBe(1);
    expect(teams[0].label).toBe('Platform');
    expect(result.edges.some((e) => e.relationshipType === 'contains')).toBe(true);
  });

  it('creates location nodes', () => {
    const postings = [
      makePosting({ location: 'London', department: null, team: null }),
    ];
    const result = inferOrgStructure(postings, []);
    const locs = result.nodes.filter((n) => n.type === 'location');
    expect(locs.length).toBe(1);
    expect(locs[0].label).toBe('London');
  });

  it('infers seniority from title and creates role nodes', () => {
    const postings = [
      makePosting({ title: 'VP of Engineering', department: 'Engineering' }),
    ];
    const result = inferOrgStructure(postings, []);
    const roles = result.nodes.filter((n) => n.type === 'role');
    expect(roles.length).toBeGreaterThan(0);
  });

  it('puts unresolvable postings in unresolvedSignals', () => {
    const postings = [
      makePosting({ department: null, team: null, location: null }),
    ];
    const result = inferOrgStructure(postings, []);
    expect(result.unresolvedSignals.length).toBe(1);
  });

  it('stats reflect postings accurately', () => {
    const postings = [
      makePosting({ department: 'Eng', location: 'London' }),
      makePosting({ department: 'Eng', location: 'Berlin' }),
      makePosting({ department: 'HR', location: 'London' }),
    ];
    const result = inferOrgStructure(postings, []);
    expect(result.stats.totalPostings).toBe(3);
    expect(result.stats.departments).toBe(2);
    expect(result.stats.locations).toBe(2);
  });

  it('processes OrgStructureSignals', () => {
    const signals = [{
      companyName: 'Acme',
      department: 'Finance',
      subDepartment: null,
      team: 'FP&A',
      location: null,
      jobFamily: null,
      title: 'Finance Manager',
      seniority: null,
      possibleReportsTo: null,
      possibleManagerTitle: null,
      evidenceText: 'Finance dept signal',
      evidenceUrl: 'https://example.com',
      confidenceScore: 85,
    }];
    const result = inferOrgStructure([], signals);
    const depts = result.nodes.filter((n) => n.type === 'department');
    expect(depts.some((d) => d.normalizedLabel === 'finance')).toBe(true);
  });
});
