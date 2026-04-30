// Verify tamper detection: mutate the HR Business Partner JD's data field
// directly so its hash will differ from the open checkout's snapshot.
import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const id = 'ff88604d-f6ab-423b-9c6c-13cfd6226ed6';
const jd = await client.query(`SELECT data FROM job_descriptions WHERE id = $1`, [id]);
const data = jd.rows[0].data;
data.__tamper_test = `mutated at ${new Date().toISOString()}`;

await client.query(
  `UPDATE job_descriptions SET data = $1::jsonb, "updatedAt" = NOW() WHERE id = $2`,
  [JSON.stringify(data), id]
);
console.log('Tampered. data now has key __tamper_test');
await client.end();
