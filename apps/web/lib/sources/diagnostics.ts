/**
 * Diagnostic helpers: classify fetch failures into actionable messages.
 * Never attempts evasion — this is pure diagnostic classification.
 */

import type { DiagnosticStatus, SourceDiagnostics } from './types';

export function ok(extra?: Partial<SourceDiagnostics>): SourceDiagnostics {
  return {
    status: 'OK',
    reason: 'Source accessible',
    robotsAllowed: true,
    authRequired: false,
    captchaDetected: false,
    rateLimited: false,
    apiAvailable: true,
    recommendedAlternative: null,
    userActionNeeded: null,
    errorCode: null,
    technicalDetails: null,
    ...extra,
  };
}

export function blocked(
  status: DiagnosticStatus,
  reason: string,
  opts: {
    recommendedAlternative?: string;
    userActionNeeded?: string;
    errorCode?: string;
    technicalDetails?: string;
    captchaDetected?: boolean;
    rateLimited?: boolean;
    robotsAllowed?: boolean;
    authRequired?: boolean;
    apiAvailable?: boolean;
  } = {},
): SourceDiagnostics {
  return {
    status,
    reason,
    robotsAllowed: opts.robotsAllowed ?? null,
    authRequired: opts.authRequired ?? false,
    captchaDetected: opts.captchaDetected ?? false,
    rateLimited: opts.rateLimited ?? false,
    apiAvailable: opts.apiAvailable ?? false,
    recommendedAlternative: opts.recommendedAlternative ?? null,
    userActionNeeded: opts.userActionNeeded ?? null,
    errorCode: opts.errorCode ?? null,
    technicalDetails: opts.technicalDetails ?? null,
  };
}

/** Classify an HTTP status code returned from a public career page. */
export function classifyHttpError(
  httpStatus: number,
  errorText?: string,
): SourceDiagnostics {
  const lower = (errorText || '').toLowerCase();

  if (httpStatus === 401 || httpStatus === 403) {
    const isCapt = lower.includes('captcha') || lower.includes('challenge');
    return blocked(
      isCapt ? 'CAPTCHA_OR_BOT_CHALLENGE' : 'LOGIN_REQUIRED',
      isCapt
        ? 'Site returned a CAPTCHA or bot challenge page.'
        : 'Access blocked — site requires authentication or blocks automated access.',
      {
        captchaDetected: isCapt,
        authRequired: !isCapt,
        recommendedAlternative:
          'Use the official ATS/job-board API or upload an exported file instead.',
        userActionNeeded:
          'JD Suite did not attempt to bypass this restriction. Please connect via the official API or provide an export.',
        errorCode: String(httpStatus),
      },
    );
  }

  if (httpStatus === 429) {
    return blocked('RATE_LIMITED', 'Server rate-limited this request.', {
      rateLimited: true,
      userActionNeeded: 'Wait before retrying, or use the official API.',
      errorCode: '429',
    });
  }

  if (httpStatus === 999) {
    return blocked(
      'LOGIN_REQUIRED',
      'Platform explicitly blocks automated access (status 999).',
      {
        recommendedAlternative:
          'This platform prohibits scraping. Use an official API, authorised export, or provide URLs manually.',
        userActionNeeded: 'JD Suite will not attempt to bypass this restriction.',
        errorCode: '999',
      },
    );
  }

  if (httpStatus === 0) {
    return blocked('NETWORK_ERROR', 'Network error — could not reach the server.', {
      technicalDetails: errorText || undefined,
    });
  }

  return blocked(
    'NETWORK_ERROR',
    `Unexpected HTTP ${httpStatus}`,
    { errorCode: String(httpStatus), technicalDetails: errorText || undefined },
  );
}

/** Classify a robots.txt disallow finding. */
export function robotsDisallowed(path: string): SourceDiagnostics {
  return blocked(
    'ROBOTS_DISALLOWED',
    `robots.txt disallows crawling of "${path}".`,
    {
      robotsAllowed: false,
      recommendedAlternative:
        'Use the official job-board API or an authorised export.',
      userActionNeeded:
        'This source has disallowed crawling. JD Suite respects robots.txt.',
    },
  );
}

/** Classify a missing API key situation. */
export function missingApiKey(keyName: string, docsUrl?: string): SourceDiagnostics {
  return blocked(
    'API_KEY_REQUIRED',
    `${keyName} is not configured.`,
    {
      apiAvailable: true,
      userActionNeeded: docsUrl
        ? `Add ${keyName} in Settings. Get a key at: ${docsUrl}`
        : `Add ${keyName} in Settings.`,
    },
  );
}

/** Classify a JS-required page (SPA). */
export function requiresJavaScript(): SourceDiagnostics {
  return blocked(
    'JS_RENDER_REQUIRED',
    'Page requires JavaScript to render job listings.',
    {
      recommendedAlternative:
        'Open the page in your browser, copy the HTML (View Source), and paste it using the "Paste HTML" option.',
      userActionNeeded:
        'Use the "Paste HTML" flow, or connect via the official ATS API (e.g. Greenhouse, Lever, Ashby).',
    },
  );
}
