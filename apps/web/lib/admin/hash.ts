import { createHash } from 'crypto';

/**
 * Deterministic JSON stringify so hash is stable regardless of key order.
 * Keys are recursively sorted; arrays preserve order.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  );
}

/**
 * Compute SHA-256 hex of a JD's content. Used for checkout/check-in
 * tamper detection. Must include all fields that constitute the JD's
 * "edit surface" — title, code, orgUnit, status, full data blob.
 */
export function computeJDHash(jd: {
  jobTitle?: string | null;
  jobCode?: string | null;
  orgUnit?: string | null;
  status?: string | null;
  data?: unknown;
}): string {
  const canonical = stableStringify({
    jobTitle: jd.jobTitle ?? '',
    jobCode: jd.jobCode ?? '',
    orgUnit: jd.orgUnit ?? '',
    status: jd.status ?? '',
    data: jd.data ?? {},
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
