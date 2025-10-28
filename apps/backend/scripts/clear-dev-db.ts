import { db } from '@/services/db';
import { getClient, destroyClient } from '@/services/redis';
import { Database } from '@/types';
import { Kysely } from 'kysely';

// Extend the database interface to include PostgreSQL system tables
interface ExtendedDatabase extends Database {
  'information_schema.tables': {
    table_name: string;
    table_schema: string;
    table_type: string;
  };
}

const extendedDb = db as unknown as Kysely<ExtendedDatabase>;

async function clearDatabase() {
  console.log('🗑️  Clearing database...');

  // Get all table names from the database
  const result = await extendedDb
    .selectFrom('information_schema.tables')
    .select('table_name')
    .where('table_schema', '=', 'public')
    .where('table_type', '=', 'BASE TABLE')
    .execute();

  const tableNames = result.map((row) => row.table_name);

  // Filter out migration tracking tables
  // E.g. kysely_migration, kysely_migration_lock
  const migrationTables = tableNames.filter(
    (name) => name.includes('migration') || name.includes('schema_version'),
  );

  // Clear each table in order (reverse dependency order)
  const tableOrder = ['game_players', 'games', 'users'];
  const tablesToClear = tableOrder.filter(
    (table) => tableNames.includes(table) && !migrationTables.includes(table),
  );

  let totalRowsDeleted = 0;

  for (const tableName of tablesToClear) {
    try {
      const deleteResult = await db.deleteFrom(tableName as any).execute();
      const rowsDeleted =
        deleteResult.length > 0 ? deleteResult[0].numDeletedRows || 0 : 0;
      totalRowsDeleted += Number(rowsDeleted);
      console.log(`  ✅ Cleared table: ${tableName} (${rowsDeleted} rows)`);
    } catch (error) {
      console.log(`  ⚠️  Error clearing table ${tableName}:`, error);
    }
  }

  // Clear any remaining tables not in the ordered list (excluding migration tables)
  const remainingTables = tableNames.filter(
    (name) => !tablesToClear.includes(name) && !migrationTables.includes(name),
  );
  for (const tableName of remainingTables) {
    try {
      const deleteResult = await db.deleteFrom(tableName as any).execute();
      const rowsDeleted =
        deleteResult.length > 0 ? deleteResult[0].numDeletedRows || 0 : 0;
      totalRowsDeleted += Number(rowsDeleted);
      console.log(`  ✅ Cleared table: ${tableName} (${rowsDeleted} rows)`);
    } catch (error) {
      console.log(`  ⚠️  Error clearing table ${tableName}:`, error);
    }
  }

  console.log(`  📊 Total rows deleted: ${totalRowsDeleted}`);
}

async function clearRedis() {
  console.log('🗑️  Clearing Redis...');

  const client = await getClient();
  await client.flushAll();
  console.log('  ✅ Cleared all Redis data');

  destroyClient();
}

async function main() {
  try {
    console.log('🚀 Starting development data cleanup...\n');

    await clearDatabase();
    console.log();

    await clearRedis();
    console.log();

    console.log('✨ Development data cleared successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing development data:', error);
    process.exit(1);
  }
}

main();
