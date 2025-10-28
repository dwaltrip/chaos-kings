import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('games')
    .addColumn('config', 'jsonb')
    .addColumn('move_history', 'jsonb')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('games')
    .dropColumn('config')
    .dropColumn('move_history')
    .execute();
}
