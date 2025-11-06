import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('game_chat_messages')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('content', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn('user_id', 'integer', (col) => col.notNull())
    .addForeignKeyConstraint('game_chat_messages_user_id_fkey', ['user_id'], 'users', [
      'id',
    ])
    .addColumn('game_id', 'integer', (col) => col.notNull())
    .addForeignKeyConstraint('game_chat_messages_game_id_fkey', ['game_id'], 'games', [
      'id',
    ])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('game_chat_messages').execute();
}
