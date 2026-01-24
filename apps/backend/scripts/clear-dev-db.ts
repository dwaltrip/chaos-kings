import { db } from '@/services/db';
import { getClient, destroyClient } from '@/services/redis';
import { sql } from 'kysely';

async function clearDatabase() {
  console.log('🗑️  Clearing database...');

  // Get all table names from the public schema (excluding migration tables)
  const result = await sql<{ table_name: string }>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE '%migration%'
      AND table_name NOT LIKE '%schema_version%'
  `.execute(db);

  const tableNames = result.rows.map((row) => row.table_name);

  if (tableNames.length === 0) {
    console.log('  ℹ️  No tables to clear');
    return;
  }

  // Use TRUNCATE with CASCADE to handle foreign key dependencies automatically
  const tableList = tableNames.map((t) => `"${t}"`).join(', ');
  await sql.raw(`TRUNCATE ${tableList} CASCADE`).execute(db);

  console.log(`  ✅ Truncated ${tableNames.length} tables: ${tableNames.join(', ')}`);
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
