// Auth token utilities. Raw tokens are URL-safe base64; only their SHA-256
// hashes are stored in the DB. One-time-use enforced via usedAt.

import { createHash, randomBytes, randomUUID } from 'node:crypto';

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function newAuthTokenId(): string {
  return randomUUID();
}

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;       // 30 min
export const MAGIC_LINK_TTL_MS  = 15 * 60 * 1000;       // 15 min
