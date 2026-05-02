/**
 * Golden fixture loader.
 *
 * Strategy selection (checked in order):
 *   1. GDrive: if GOOGLE_SERVICE_ACCOUNT_KEY + GOLDEN_GDRIVE_FILE_ID are both set
 *   2. Local:  reads from GOLDEN_FIXTURES_PATH env var (default: absolute path below)
 *
 * Local strategy is fully implemented.
 * GDrive strategy is a documented stub — see docs/ultra/14-golden-fixtures-setup.md.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { GoldenFixtureFile } from './types';

const DEFAULT_LOCAL_PATH = '/Users/tomaszrey/Desktop/jd-suite-golden/golden-jd-fixtures.json';

/**
 * Load the golden fixture file. Returns null if file is not accessible.
 * Callers should skip tests (not fail) when this returns null.
 */
export async function loadGoldenFixtures(): Promise<GoldenFixtureFile | null> {
  const strategy = resolveStrategy();
  if (strategy === 'gdrive') {
    return loadFromGDrive();
  }
  return loadFromLocal();
}

function resolveStrategy(): 'local' | 'gdrive' {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOLDEN_GDRIVE_FILE_ID) {
    return 'gdrive';
  }
  return 'local';
}

async function loadFromLocal(): Promise<GoldenFixtureFile | null> {
  const fixturePath = process.env.GOLDEN_FIXTURES_PATH ?? DEFAULT_LOCAL_PATH;
  try {
    const raw = await fs.readFile(path.resolve(fixturePath), 'utf-8');
    const parsed = JSON.parse(raw) as GoldenFixtureFile;
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// GDrive stub — NOT YET IMPLEMENTED
// ---------------------------------------------------------------------------

async function loadFromGDrive(): Promise<GoldenFixtureFile | null> {
  // TODO(phase-2): Implement Google Drive fetch.
  //
  // Required env vars:
  //   GOOGLE_SERVICE_ACCOUNT_KEY  — full JSON string of a service account key with
  //                                  Drive read scope on the fixture file
  //   GOLDEN_GDRIVE_FILE_ID       — the Drive file ID (from the sharing URL)
  //
  // Implementation shape (googleapis npm package):
  //
  //   import { google } from 'googleapis';
  //   const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!);
  //   const auth = new google.auth.JWT(
  //     sa.client_email, undefined, sa.private_key,
  //     ['https://www.googleapis.com/auth/drive.readonly'],
  //   );
  //   const drive = google.drive({ version: 'v3', auth });
  //   const res = await drive.files.get(
  //     { fileId: process.env.GOLDEN_GDRIVE_FILE_ID!, alt: 'media' },
  //     { responseType: 'stream' },
  //   );
  //   const chunks: Buffer[] = [];
  //   for await (const chunk of res.data) chunks.push(Buffer.from(chunk));
  //   return JSON.parse(Buffer.concat(chunks).toString('utf-8')) as GoldenFixtureFile;
  //
  // Dependencies to add when implementing:
  //   pnpm --filter web add googleapis
  //
  // See docs/ultra/14-golden-fixtures-setup.md §3 for full setup.

  console.warn(
    '[golden] GDrive strategy selected but not yet implemented — falling back to local.',
  );
  return loadFromLocal();
}
