const { readFile, readdir } = require('node:fs/promises');
const path = require('node:path');
const { Client } = require('pg');

async function migrate() {
  // Compose injects production variables. Local usage also supports service/.env.
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(path.join(__dirname, '..', '.env'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  for (const key of ['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_NAME']) {
    if (!process.env[key]) throw new Error(`Missing environment variable: ${key}`);
  }
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    // Serialize concurrent runs; release automatically at COMMIT/ROLLBACK.
    await client.query('SELECT pg_advisory_xact_lock(181865, 1)');
    await client.query(`CREATE TABLE IF NOT EXISTS "app_schema_migrations" (
      "name" text PRIMARY KEY,
      "applied_at" timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query('SELECT "name" FROM "app_schema_migrations"');
    const applied = new Set(rows.map((row) => row.name));
    const directory = path.join(__dirname, '..', 'migrations');
    const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
    const pending = [];
    for (const file of files) {
      if (applied.has(file)) continue;
      await client.query(await readFile(path.join(directory, file), 'utf8'));
      await client.query('INSERT INTO "app_schema_migrations" ("name") VALUES ($1)', [file]);
      pending.push(file);
    }
    await client.query('COMMIT');
    for (const file of pending) console.log(`Applied: ${file}`);
    console.log(pending.length ? 'Database migrations complete.' : 'Database is already up to date.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error(`Database migration failed: ${error.message}`);
  process.exitCode = 1;
});
