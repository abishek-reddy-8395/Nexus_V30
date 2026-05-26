/**
 * Nexus V30 — Migration Runner
 *
 * Usage: pnpm db:migrate
 *
 * Applies SQL migrations in order from database/migrations/sql/*.sql
 * Tracks applied migrations in a _migrations table.
 * Safe to run multiple times (idempotent).
 */

import { Client } from 'pg';
import fs         from 'fs';
import path       from 'path';
import { Logger } from '../../shared/helpers/logger';

const logger = new Logger('Migration');

const MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS _migrations (
    id         SERIAL PRIMARY KEY,
    filename   TEXT NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

async function run(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) { logger.error('DATABASE_URL not set'); process.exit(1); }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    // Ensure migrations table exists
    await client.query(MIGRATIONS_TABLE);

    // Get already-applied migrations
    const applied = await client.query<{ filename: string }>('SELECT filename FROM _migrations ORDER BY id');
    const appliedSet = new Set(applied.rows.map(r => r.filename));

    // Find migration SQL files
    const migrationsDir = path.join(__dirname, 'sql');
    if (!fs.existsSync(migrationsDir)) {
      logger.warn('No migrations directory found at', migrationsDir);
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();  // lexicographic order: 001_init.sql, 002_users.sql, ...

    let applied_count = 0;
    for (const file of files) {
      if (appliedSet.has(file)) { logger.info(`  skip: ${file}`); continue; }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      logger.info(`  apply: ${file}`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations(filename) VALUES($1)', [file]);
        await client.query('COMMIT');
        applied_count++;
      } catch (err: any) {
        await client.query('ROLLBACK');
        logger.error(`Failed to apply ${file}: ${err.message}`);
        process.exit(1);
      }
    }

    logger.info(`Migrations complete. Applied: ${applied_count}, Skipped: ${files.length - applied_count}`);
  } finally {
    await client.end();
  }
}

run();
