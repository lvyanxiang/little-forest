const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { Client } = require('pg');

async function initialize() {
  if (typeof process.loadEnvFile === 'function') {
    try { process.loadEnvFile(path.join(__dirname, '..', '.env')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const key of ['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_NAME']) {
    if (!process.env[key]) throw new Error(`Missing environment variable: ${key}`);
  }
  const client = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(181865, 1)');
    await client.query(await readFile(path.join(__dirname, '..', 'init', 'init.sql'), 'utf8'));
    await client.query('COMMIT');
    console.log('Initial data is ready. Existing settings and records were preserved.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { await client.end(); }
}

initialize().catch((error) => {
  console.error(`Database initialization failed: ${error.message}`);
  process.exitCode = 1;
});
