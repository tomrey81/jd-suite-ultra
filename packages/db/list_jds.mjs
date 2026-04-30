import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const orgs = await client.query('SELECT o.id, o.name, COUNT(jd.id)::int AS jd_count FROM organisations o LEFT JOIN job_descriptions jd ON jd."orgId" = o.id GROUP BY o.id ORDER BY jd_count DESC');
console.log('=== ORGS ===');
console.log(JSON.stringify(orgs.rows, null, 2));

const jds = await client.query(`
  SELECT id, "jobTitle", "jobCode", "orgUnit", folder, status, "orgId", "createdAt", data
  FROM job_descriptions
  ORDER BY "createdAt" DESC
`);
console.log(`\n=== JDs (${jds.rows.length}) ===`);
for (const jd of jds.rows) {
  console.log(`---\n[${jd.jobTitle}] folder=${jd.folder ?? 'null'} status=${jd.status} org=${jd.orgId.slice(0,8)} id=${jd.id.slice(0,8)}`);
  if (jd.orgUnit) console.log(`  orgUnit: ${jd.orgUnit}`);
  if (jd.jobCode) console.log(`  jobCode: ${jd.jobCode}`);
  const dk = Object.keys(jd.data || {});
  console.log(`  data keys (${dk.length}): ${dk.slice(0,8).join(', ')}${dk.length>8?'...':''}`);
}
await client.end();
