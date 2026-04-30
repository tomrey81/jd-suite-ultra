import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

// Demo user + memberships
const u = await c.query(`SELECT id, email FROM users WHERE email = 'demo@quadrance.app'`);
console.log('user:', u.rows);
const uid = u.rows[0]?.id;
if (uid) {
  const m = await c.query(`SELECT m.role, o.id, o.name FROM memberships m JOIN organisations o ON o.id = m."orgId" WHERE m."userId" = $1`, [uid]);
  console.log('memberships:', m.rows);
  const orgIds = m.rows.map(r => r.id);
  for (const oid of orgIds) {
    const j = await c.query(`SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE status='ARCHIVED')::int AS arch, COUNT(*) FILTER (WHERE folder='Sample JDs')::int AS samples FROM job_descriptions WHERE "orgId" = $1`, [oid]);
    console.log(`org ${oid.slice(0,8)} → JDs:`, j.rows[0]);
  }
}

// What does WorkspacePage's findFirst() return?
const ff = await c.query(`SELECT id, name FROM organisations ORDER BY "createdAt" ASC LIMIT 1`);
console.log('findFirst org (probably what dashboard uses):', ff.rows);

await c.end();
