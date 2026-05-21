# JD Suite Ultra — API Error Reference

> Last updated: 2026-05-10

All API errors follow a consistent JSON shape:

```json
{
  "error": "Human-readable message",
  "code": "ERROR_CODE",        // optional, machine-readable
  "details": { ... }           // optional, additional context
}
```

---

## HTTP Status Codes

| Status | Meaning | When Used |
|--------|---------|-----------|
| 200 | OK | Successful GET, PUT, POST |
| 201 | Created | Resource created (POST) |
| 400 | Bad Request | Validation error, malformed body |
| 401 | Unauthorized | No valid session cookie |
| 403 | Forbidden | Session valid but insufficient permissions |
| 404 | Not Found | Resource doesn't exist or is not accessible to this org |
| 409 | Conflict | Duplicate resource (e.g. duplicate email) |
| 413 | Payload Too Large | File upload exceeds size limit |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | AI provider unavailable |

---

## Auth Errors

| Code | HTTP | Message | Cause |
|------|------|---------|-------|
| `UNAUTHORIZED` | 401 | Unauthorized | No session cookie |
| `FORBIDDEN` | 403 | Forbidden | Session valid but role insufficient |
| `INVALID_CREDENTIALS` | 400 | Invalid email or password | Wrong credentials |
| `RATE_LIMITED` | 429 | Too many login attempts | 10+ attempts in 15 min from same IP |
| `TOKEN_EXPIRED` | 400 | Token has expired | Magic link / reset token past `expiresAt` |
| `TOKEN_USED` | 400 | Token has already been used | Replay of single-use token |
| `TOKEN_INVALID` | 400 | Invalid token | Token hash mismatch |

---

## JD Errors

| Code | HTTP | Message | Cause |
|------|------|---------|-------|
| `JD_NOT_FOUND` | 404 | Job description not found | JD doesn't exist or belongs to different org |
| `JD_ARCHIVED` | 400 | Job description is archived | Attempting to edit ARCHIVED JD |
| `JD_APPROVED` | 400 | Cannot edit an approved JD | Attempting direct edit of APPROVED JD |
| `JD_VERSION_NOT_FOUND` | 404 | Version not found | Restore target doesn't exist |
| `JD_EXPORT_FAILED` | 500 | Export generation failed | PDF/DOCX rendering error |

---

## Axiomera Errors

| Code | HTTP | Message | Cause |
|------|------|---------|-------|
| `AXIOMERA_DISABLED` | 403 | Axiomera engine is not enabled | `ENABLE_AXIOMERA_ENGINE` flag is off |
| `AXIOMERA_SCHEMA_FAILED` | 500 | AI response failed schema validation after retries | LLM returned invalid JSON 3× |
| `AXIOMERA_TIMEOUT` | 503 | Axiomera evaluation timed out | AI call exceeded 50s timeout |
| `JD_TOO_SHORT` | 400 | Job description is too short for evaluation | JD text under ~100 words |

---

## AI / LLM Errors

| Code | HTTP | Message | Cause |
|------|------|---------|-------|
| `AI_UNAVAILABLE` | 503 | AI service is temporarily unavailable | Anthropic 429/529 after retries |
| `AI_API_ERROR` | 500 | AI API returned an error | Anthropic 4xx/5xx |
| `AI_INVALID_KEY` | 500 | AI API key is not configured | `ANTHROPIC_API_KEY` missing |

---

## Source / Connector Errors

| Code | HTTP | Message | Cause |
|------|------|---------|-------|
| `SOURCE_NOT_FOUND` | 404 | Source connection not found | SourceConnection doesn't exist |
| `SOURCE_AUTH_FAILED` | 400 | Connector authentication failed | Invalid API key or credentials |
| `SOURCE_NO_JOBS` | 200 | No jobs found at this source | Source returned 0 results |
| `SOURCE_SCRAPE_FAILED` | 500 | Failed to fetch URL | Network error or blocked scraper |

---

## Pay Group Errors

| Code | HTTP | Message | Cause |
|------|------|---------|-------|
| `PAY_GROUP_NOT_FOUND` | 404 | Pay group not found | |
| `JD_ALREADY_IN_GROUP` | 409 | JD is already in this pay group | Duplicate PayGroupMember |
| `COMMENT_REQUIRED` | 400 | A comment is required for this action | EUPTD compliance — audit log comment missing |

---

## Admin Errors

| Code | HTTP | Message | Cause |
|------|------|---------|-------|
| `NOT_PLATFORM_ADMIN` | 403 | Platform admin access required | `isPlatformAdmin = false` |
| `USER_NOT_FOUND` | 404 | User not found | |
| `ORG_NOT_FOUND` | 404 | Organisation not found | |
| `ACCESS_CODE_EXPIRED` | 400 | Access code has expired | |
| `ACCESS_CODE_EXHAUSTED` | 400 | Access code usage limit reached | |

---

## Rate Limit Response

When rate-limited (429), the response includes retry guidance:

```json
{
  "error": "Too many requests",
  "code": "RATE_LIMITED",
  "details": {
    "retryAfterMs": 847000,
    "resetAt": "2026-05-10T12:00:00.000Z"
  }
}
```

---

## Validation Errors (400)

Zod validation failures return:

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "fields": {
      "email": "Invalid email address",
      "password": "String must contain at least 8 character(s)"
    }
  }
}
```

---

## Error Handling Best Practices

### Client Side

```typescript
const res = await fetch('/api/jd', { method: 'POST', body: JSON.stringify(data) });
if (!res.ok) {
  const err = await res.json();
  // err.error — human message
  // err.code  — machine code for switch/case
  // err.details — field-level validation etc.
  throw new ApiError(err.code ?? 'UNKNOWN', err.error, res.status);
}
```

### Server Side (Route Handlers)

```typescript
// Standard error response helper
function apiError(message: string, status: number, code?: string, details?: unknown) {
  return NextResponse.json({ error: message, code, details }, { status });
}

// Usage:
if (!session) return apiError('Unauthorized', 401, 'UNAUTHORIZED');
if (!jd) return apiError('Job description not found', 404, 'JD_NOT_FOUND');
```

---

## What NOT to Return in Errors

- Stack traces (leaks internal paths)
- SQL error messages (leaks schema)
- Raw Anthropic API error bodies (may contain prompt content)
- `passwordHash` or any credential data
- Other users' data
