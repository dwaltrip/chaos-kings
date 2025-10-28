import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('game_players')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('game_id', 'integer', (col) => col.notNull().references('games.id'))
    .addColumn('user_id', 'integer', (col) => col.notNull().references('users.id'))
    .addColumn('joined_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn('status', 'varchar(50)', (col) => col.notNull())
    .addColumn('player_index', 'integer', (col) => col.notNull())
    .addColumn('data', 'json')
    .addUniqueConstraint('game_players_game_id_player_id_unique', ['game_id', 'user_id'])
    .execute();

  await db.schema
    .createIndex('game_players_game_id_index')
    .on('game_players')
    .column('game_id')
    .execute();

  await db.schema
    .createIndex('game_players_player_id_index')
    .on('game_players')
    .column('user_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('game_players').execute();
}
