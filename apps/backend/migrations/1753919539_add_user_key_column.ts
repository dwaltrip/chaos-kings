import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('user_key', 'varchar(255)', (col) => col.notNull().unique())
    .execute();

  await db.schema
    .createIndex('idx_users_user_key')
    .on('users')
    .column('user_key')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_users_user_key').execute();

  await db.schema.alterTable('users').dropColumn('user_key').execute();
}
