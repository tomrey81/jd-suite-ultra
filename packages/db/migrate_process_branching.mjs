// Add `outgoing` JSONB to pmoa_process_steps to support branching.
// `outgoing` shape: [{ targetStepId, label }] — each step explicitly lists
// its next step(s). On migration, populate from existing linear stepOrder.
// Idempotent — safe to re-run.
import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

await c.query(`ALTER TABLE pmoa_process_steps ADD COLUMN IF NOT EXISTS "outgoing" JSONB`);
console.log('  ✓ added outgoing column');

// Backfill: for each step with no outgoing, set [{ targetStepId: nextByOrder.id }]
const procs = await c.query(`SELECT DISTINCT "processId" FROM pmoa_process_steps WHERE outgoing IS NULL`);
let backfilled = 0;
for (const row of procs.rows) {
  const procId = row.processId;
  const steps = (await c.query(
    `SELECT id, "stepOrder" FROM pmoa_process_steps WHERE "processId" = $1 ORDER BY "stepOrder" ASC`,
    [procId],
  )).rows;
  for (let i = 0; i < steps.length; i++) {
    const next = steps[i + 1];
    const outgoing = next ? [{ targetStepId: next.id, label: '' }] : [];
    await c.query(`UPDATE pmoa_process_steps SET outgoing = $1::jsonb WHERE id = $2`, [JSON.stringify(outgoing), steps[i].id]);
    backfilled++;
  }
}
console.log(`  ✓ backfilled outgoing on ${backfilled} steps`);

await c.end();
console.log('Done.');
