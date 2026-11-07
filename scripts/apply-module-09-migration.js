import fs from 'node:fs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

async function run() {
  console.log('Connecting to PostgreSQL database for Module 9 migration...');
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected! Reading Module 9 migration SQL...');

  const sql = fs.readFileSync('prisma/migrations/20261105120000_offline_sync_conflicts/migration.sql', 'utf8');

  console.log('Applying Module 9 Offline Sync Conflicts migration...');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✔ Migration 20261105120000_offline_sync_conflicts applied successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
