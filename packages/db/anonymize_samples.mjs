// Anonymise existing JDs: pick ~10 best, scrub identifiers, mark folder=Sample JDs.
// Archive the rest. Idempotent — safe to re-run.

import pg from 'pg';
import fs from 'fs';
const { Client } = pg;

const ANON_ORG = 'EUPTD Enterprises';

// Known company tokens to scrub (case-insensitive, global)
const SCRUB_PATTERNS = [
  [/\bDeloitte\s+Advisory\b/gi, ANON_ORG + ' Advisory'],
  [/\bDeloitte\b/gi, ANON_ORG],
  [/\bPwC\b/gi, ANON_ORG],
  [/\bIBACentre\b/gi, 'Internal Apps Centre'],
  [/\bInternal Business Application Centre\b/gi, 'Internal Apps Centre'],
  [/\bCD\s*PROJEKT\s*RED\b/gi, ANON_ORG + ' Studios'],
  [/\bCD\s*PROJEKT\b/gi, ANON_ORG + ' Studios'],
  [/\bSTRABAG\b/gi, ANON_ORG + ' Construction'],
  [/\bMerz\s+Therapeutics(?:\s+Poland)?\b/gi, ANON_ORG + ' Therapeutics'],
  [/\bMerz\b/gi, ANON_ORG],
  [/\bDeel(?:\s+Poland)?\b/gi, ANON_ORG + ' Payroll'],
  [/\bSignal\s+Group(?:\s+sp\.?\s*z\s*o\.?o\.?)?\b/gi, ANON_ORG + ' Holdings'],
  [/\bGXO\s+Logistics(?:,?\s*Inc\.?)?\b/gi, ANON_ORG + ' Logistics'],
  [/\bGXO\b/gi, ANON_ORG + ' Logistics'],
  [/\bUrząd\s+Miasta\s+Krakowa\b/gi, ANON_ORG + ' Public Authority'],
  [/\bUMK\b/gi, ANON_ORG + ' PA'],
  [/\bHAVI(\s+Group)?\b/gi, ANON_ORG],
  // Generic Polish entity suffixes
  [/\bsp\.?\s*z\s*o\.?o\.?\b/gi, ''],
];

function scrubString(s) {
  if (typeof s !== 'string') return s;
  let out = s;
  for (const [pat, repl] of SCRUB_PATTERNS) {
    out = out.replace(pat, repl);
  }
  return out;
}

function scrubData(data) {
  if (!data || typeof data !== 'object') return data;
  const out = Array.isArray(data) ? [] : {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') out[k] = scrubString(v);
    else if (v && typeof v === 'object') out[k] = scrubData(v);
    else out[k] = v;
  }
  return out;
}

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

// 1. Select curated set — these are the best fully-completed JDs covering diverse roles
const KEEP_IDS = [
  'ff88604d',  // HR Business Partner
  '26a7386e',  // Compensation & Benefits Manager (Deloitte)
  '9a615d68',  // Workday Developer (PwC)
  'dac5e012',  // Total Rewards Manager (CD PROJEKT)
  'b059bb9a',  // Finance Manager (Merz)
  '512198b8',  // Payroll Implementation Manager (Deel)
  '68d9947b',  // VP Energy Management
  '097dac14',  // Senior Director Regional People BP
  '03dd48d7',  // Digital Product Design Lead
  'c0206f70',  // Project Manager - Total Rewards (GXO)
  '280430a8',  // Hub C&B Manager Eastern Europe
  '02fa4a70',  // Compensation Specialist
];

// Resolve to full UUIDs
const resolved = await client.query(
  `SELECT id, "jobTitle", "orgUnit", "jobCode", data FROM job_descriptions WHERE substring(id::text, 1, 8) = ANY($1::text[])`,
  [KEEP_IDS]
);
console.log(`Matched ${resolved.rows.length}/${KEEP_IDS.length} curated JDs`);

if (resolved.rows.length === 0) {
  console.log('No matches found — exiting');
  await client.end();
  process.exit(0);
}

// 1b. Backup originals locally before destructive write
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = `./jd_backup_${ts}.jsonl`;
const backupAll = await client.query(
  `SELECT * FROM job_descriptions WHERE "orgId" IN (SELECT id FROM organisations WHERE name LIKE 'Quadrance%')`
);
fs.writeFileSync(backupPath, backupAll.rows.map(r => JSON.stringify(r)).join('\n'));
console.log(`Backup saved: ${backupPath} (${backupAll.rowCount} rows)`);

// 2. Anonymise + mark folder
let updated = 0;
for (const jd of resolved.rows) {
  const newTitle = scrubString(jd.jobTitle || '');
  const newOrgUnit = scrubString(jd.orgUnit || '') || 'EUPTD Enterprises';
  const newJobCode = jd.jobCode ? scrubString(jd.jobCode).replace(/^[A-Za-z]+-/, 'EUPTD-') : null;
  const newData = scrubData(jd.data);

  // Also overwrite orgUnit inside data (it's duplicated there)
  if (newData && typeof newData === 'object') {
    newData.orgUnit = newOrgUnit;
  }

  await client.query(
    `UPDATE job_descriptions
     SET "jobTitle" = $1,
         "orgUnit" = $2,
         "jobCode" = $3,
         data = $4::jsonb,
         folder = 'Sample JDs',
         "updatedAt" = NOW()
     WHERE id = $5`,
    [newTitle, newOrgUnit, newJobCode, JSON.stringify(newData), jd.id]
  );
  updated++;
  console.log(`  ✓ Anonymised: ${newTitle} (${newOrgUnit})`);
}

// 3. Archive everything else in Quadrance Demo org (so the Library shows only the curated samples)
const KEEP_FULL_IDS = resolved.rows.map(r => r.id);
const archived = await client.query(
  `UPDATE job_descriptions
   SET status = 'ARCHIVED', "archivedAt" = NOW()
   WHERE id::text != ALL($1::text[])
     AND "orgId" IN (SELECT id FROM organisations WHERE name LIKE 'Quadrance%' OR name LIKE 'EUPTD%')
     AND status != 'ARCHIVED'
   RETURNING id`,
  [KEEP_FULL_IDS]
);
console.log(`\nArchived ${archived.rowCount} non-curated JDs`);

// 4. Rename Quadrance Demo org → EUPTD Enterprises (Demo)
const orgRename = await client.query(
  `UPDATE organisations SET name = 'EUPTD Enterprises (Demo)', "updatedAt" = NOW()
   WHERE name = 'Quadrance Demo' RETURNING id, name`
);
if (orgRename.rowCount > 0) {
  console.log(`Renamed org: ${orgRename.rows[0].name}`);
}

console.log(`\nDone. ${updated} samples anonymised, ${archived.rowCount} archived.`);
await client.end();
