/**
 * Build canonical share URLs for JD Suite entities.
 * Returns absolute URLs when an origin is available, relative paths otherwise.
 */

function origin(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  // Server side — best effort from env
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return '';
}

export function jdShareUrl(jdId: string): string {
  const o = origin();
  return `${o}/jd/${jdId}`;
}

export function jdMobileEditUrl(jdId: string): string {
  const o = origin();
  return `${o}/jd/${jdId}?mode=mobile`;
}

export function taskShareUrl(taskId: string): string {
  const o = origin();
  return `${o}/command-center?task=${taskId}`;
}

export function platformMobileUrl(): string {
  const o = origin();
  return `${o}/welcome?source=qr`;
}

export interface ShareLinks {
  copy: string;
  email: string;
  teams: string;
  slack: string;
  whatsapp: string;
}

export function buildShareLinks(url: string, title = 'JD Suite share'): ShareLinks {
  const subject = encodeURIComponent(title);
  const body = encodeURIComponent(`${title}\n${url}`);
  const text = encodeURIComponent(`${title}: ${url}`);
  return {
    copy: url,
    email: `mailto:?subject=${subject}&body=${body}`,
    teams: `https://teams.microsoft.com/share?href=${encodeURIComponent(url)}&msgText=${text}`,
    slack: `https://slack.com/share?text=${text}&url=${encodeURIComponent(url)}`,
    whatsapp: `https://wa.me/?text=${text}`,
  };
}
