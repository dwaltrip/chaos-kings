import { testDb } from '@/services/test-db';
import { promises as fs } from 'fs';
import { Migrator, FileMigrationProvider, sql } from 'kysely';
import * as path from 'path';

export const setupTestDb = async () => {
  // Ensure we're in test environment
  process.env.NODE_ENV = 'test';
  
  // Run migrations on test database
  const migrator = new Migrator({
    db: testDb,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, '../../migrations'),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  if (error) {
    console.error('Failed to migrate test database');
    throw error;
  }

  if (results) {
    results.forEach((it) => {
      if (it.status === 'Success') {
        console.log(`migration "${it.migrationName}" was executed successfully`);
      } else if (it.status === 'Error') {
        console.error(`failed to execute migration "${it.migrationName}"`);
      }
    });
  }
};

export const cleanupTestDb = async () => {
  // Clear all users between tests and reset sequence
  await testDb.deleteFrom('users').execute();
  await sql`ALTER SEQUENCE users_id_seq RESTART WITH 1;`.execute(testDb);
};

export const teardownTestDb = async () => {
  // Run down migrations to clean up test database
  const migrator = new Migrator({
    db: testDb,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, '../../migrations'),
    }),
  });

  await migrator.migrateDown();
  await testDb.destroy();
};

export { testDb };
