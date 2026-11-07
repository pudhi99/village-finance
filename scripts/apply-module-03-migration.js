import fs from 'node:fs';
import pg from 'pg';

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

async function run() {
  console.log('Connecting to PostgreSQL database...');
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected! Reading migration SQL...');

  const sql = fs.readFileSync('prisma/migrations/20261104020000_loan_schemes_and_loans/migration.sql', 'utf8');

  console.log('Applying Module 3 migration...');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✔ Migration 20261104020000_loan_schemes_and_loans applied successfully!');
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
