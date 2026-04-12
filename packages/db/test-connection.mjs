import { neonConfig, Pool } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineTLS = false;
neonConfig.pipelineConnect = false;

const url = process.env.DATABASE_URL;
console.log('URL:', url?.substring(0, 50));

// Parse URL to pass individual params
const parsed = new URL(url);
const pool = new Pool({
  host: parsed.hostname,
  port: parseInt(parsed.port || '5432'),
  database: parsed.pathname.slice(1),
  user: parsed.username,
  password: decodeURIComponent(parsed.password),
  ssl: true,
});

console.log('Pool created with host:', parsed.hostname);

const adapter = new PrismaNeon(pool);
const db = new PrismaClient({ adapter });

try {
  const orgs = await db.organisation.findMany();
  console.log('SUCCESS! Orgs:', orgs.length, orgs.map(o => o.name));
} catch (e) {
  console.error('ERROR:', e.message?.substring(0, 200));
} finally {
  await pool.end();
}
