import sanitizeHtml from 'sanitize-html';

/**
 * Strip invisible / control / zero-width characters before HTML parsing.
 * Defeats Unicode-based scheme bypasses like `java<ZWJ>script:`.
 * MUST be applied before sanitize-html. Lifted directly from
 * admin-panel-lite playbook (load-bearing, do not modify the regex).
 */
const INVISIBLE_RE = new RegExp(
  '[\\u0000-\\u001F\\u007F-\\u009F\\u00AD\\u200B-\\u200F\\u2028-\\u202F\\u2060-\\u206F\\uFEFF]',
  'g',
);

const CONTENT_SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'u', 'small', 'br', 'span', 'a', 'p'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    span: ['class'],
    p: ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
  },
  disallowedTagsMode: 'discard',
};

export function sanitizeContentValue(s: unknown): string {
  if (typeof s !== 'string') return '';
  return sanitizeHtml(s.replace(INVISIBLE_RE, ''), CONTENT_SANITIZE_OPTS);
}

/**
 * Strict text-only sanitizer for fields that must never contain HTML
 * (names, labels, codes). Strips tags entirely and zero-width chars.
 */
export function sanitizeText(s: unknown, maxLen = 500): string {
  if (typeof s !== 'string') return '';
  return sanitizeHtml(s.replace(INVISIBLE_RE, ''), { allowedTags: [], allowedAttributes: {} })
    .trim()
    .slice(0, maxLen);
}
