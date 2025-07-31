import { testDb } from '@/services/test-db';
import { promises as fs } from 'fs';
import { Migrator, FileMigrationProvider, sql, NO_MIGRATIONS } from 'kysely';
import * as path from 'path';

let isDbSetup = false;

export const setupTestDb = async () => {
  // Only run migrations once across all test files
  if (isDbSetup) {
    return;
  }
  
  // Ensure we're in test environment
  process.env.NODE_ENV = 'test';
  
  // First, clean up any existing schema from previous test runs
  try {
    // Drop all tables and the kysely migration table
    await sql`DROP SCHEMA IF EXISTS public CASCADE`.execute(testDb);
    await sql`CREATE SCHEMA public`.execute(testDb);
    await sql`GRANT ALL ON SCHEMA public TO postgres`.execute(testDb);
    await sql`GRANT ALL ON SCHEMA public TO public`.execute(testDb);
  } catch (error) {
    // Ignore errors - database might not exist yet
    console.warn('Failed to drop existing schema (continuing with migrations). Error:', error);
  }

  const migrator = new Migrator({
    db: testDb,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, '../../migrations'),
    }),
  });
  
  // Now run migrations to latest
  const { error, results } = await migrator.migrateToLatest();

  if (error) {
    console.error('Failed to migrate test database');
    throw error;
  }

  // Only log if we actually ran migrations (not if they were already up to date)
  if (results && results.length > 0) {
    console.log(`Test database setup: executed ${results.length} migration(s) successfully`);
  }
  
  isDbSetup = true;
};

export const cleanupTestDb = async () => {
  // Get all user-defined tables and truncate them
  const result = await sql<{ table_name: string }>`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
  `.execute(testDb);
    
  // Truncate all tables with CASCADE to handle foreign keys
  // RESTART IDENTITY resets sequences
  for (const row of result.rows) {
    await sql`TRUNCATE TABLE ${sql.id(row.table_name)} RESTART IDENTITY CASCADE`.execute(testDb);
  }
};

export const teardownTestDb = async () => {
  // Clean up any remaining data and close database connection
  await cleanupTestDb();
  await testDb.destroy();
};

export { testDb };
