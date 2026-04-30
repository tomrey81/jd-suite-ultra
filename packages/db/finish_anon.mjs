// Finish job: archive non-curated JDs + rename org. Re-runs idempotently.
import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

// All JDs in folder=Sample JDs are kept; everything else in Quadrance/EUPTD orgs gets archived
const archived = await client.query(
  `UPDATE job_descriptions
   SET status = 'ARCHIVED', "archivedAt" = NOW()
   WHERE (folder IS NULL OR folder != 'Sample JDs')
     AND "orgId" IN (SELECT id FROM organisations WHERE name LIKE 'Quadrance%' OR name LIKE 'EUPTD%')
     AND status != 'ARCHIVED'
   RETURNING id, "jobTitle"`
);
console.log(`Archived ${archived.rowCount} non-curated JDs`);

// Rename org
const orgRename = await client.query(
  `UPDATE organisations SET name = 'EUPTD Enterprises (Demo)', "updatedAt" = NOW()
   WHERE name = 'Quadrance Demo' RETURNING id, name`
);
if (orgRename.rowCount > 0) console.log(`Renamed org: ${orgRename.rows[0].name}`);
else console.log('Org already renamed (idempotent)');

// Verify
const samples = await client.query(
  `SELECT "jobTitle", folder, "orgUnit", status FROM job_descriptions WHERE folder = 'Sample JDs' ORDER BY "jobTitle"`
);
console.log(`\nFinal Sample JDs (${samples.rowCount}):`);
for (const s of samples.rows) console.log(`  • ${s.jobTitle} — ${s.orgUnit} [${s.status}]`);

await client.end();
