const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  // No DB configured. Throw so loaders can catch and fall through.
  throw new Error('DATABASE_URL not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => console.error('Postgres error:', err.message));

module.exports = { pool };
