/**
 * Unit tests — ATS Keyword Analysis (Phase 8)
 * Run with: pnpm --filter web exec jest lib/sources/__tests__/ats-keywords.test.ts
 */

import { analyseAtsKeywords } from '../ats-keywords';

describe('analyseAtsKeywords', () => {
  it('returns a disclaimer', () => {
    const result = analyseAtsKeywords('Engineer', 'Some job description');
    expect(result.disclaimer).toBeTruthy();
    expect(result.disclaimer).toContain('JD Suite');
  });

  it('extracts tools from description', () => {
    const result = analyseAtsKeywords(
      'Data Analyst',
      'We require Excel, Tableau and Power BI for daily reporting. SQL experience essential.',
    );
    const tools = result.criticalKeywords.concat(result.supportingKeywords)
      .filter((k) => k.category === 'tool')
      .map((k) => k.keyword);
    expect(tools.some((t) => /excel/i.test(t))).toBe(true);
    expect(tools.some((t) => /tableau/i.test(t))).toBe(true);
  });

  it('detects knockout criteria with "must have"', () => {
    const result = analyseAtsKeywords(
      'Software Engineer',
      'Must have 5+ years experience with Java. Required: AWS Certified. Mandatory: BSc degree.',
    );
    expect(result.likelyKnockoutCriteria.length).toBeGreaterThan(0);
    expect(result.criticalKeywords.some((k) => k.isLikelyKnockout)).toBe(true);
  });

  it('flags short descriptions', () => {
    const result = analyseAtsKeywords('Role', 'Short');
    expect(result.warningFlags.some((f) => /short/i.test(f))).toBe(true);
  });

  it('detects certifications', () => {
    const result = analyseAtsKeywords(
      'Finance Manager',
      'CPA or CFA required. PMP certification is a plus.',
    );
    const certs = result.criticalKeywords.concat(result.supportingKeywords)
      .filter((k) => k.category === 'certification');
    expect(certs.length).toBeGreaterThan(0);
  });

  it('detects methodologies', () => {
    const result = analyseAtsKeywords(
      'Project Manager',
      'Experience with Agile, Scrum, and Kanban methodologies. CI/CD pipelines preferred.',
    );
    const methods = result.criticalKeywords.concat(result.supportingKeywords)
      .filter((k) => k.category === 'methodology');
    expect(methods.length).toBeGreaterThan(0);
  });

  it('returns missing common keywords for data jobs', () => {
    const result = analyseAtsKeywords(
      'Data Scientist',
      'We are looking for an analytical person who loves working with data.',
      'data',
    );
    expect(result.missingCommonKeywords.length).toBeGreaterThan(0);
  });

  it('criticalKeywords have frequency and evidence fields', () => {
    const result = analyseAtsKeywords(
      'Engineer',
      'Must have Java. Required: 5 years Java experience. Java certifications preferred.',
    );
    for (const kw of result.criticalKeywords) {
      expect(typeof kw.frequency).toBe('number');
      expect(typeof kw.keyword).toBe('string');
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(kw.confidence);
    }
  });
});
