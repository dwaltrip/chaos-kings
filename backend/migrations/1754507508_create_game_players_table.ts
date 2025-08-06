import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('game_players')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('game_id', 'integer', (col) => col.notNull().references('games.id'))
    .addColumn('player_id', 'integer', (col) => col.notNull().references('users.id'))
    .addColumn('joined_at', 'timestamp', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn('status', 'varchar(50)', (col) => col.notNull())
    .addColumn('color', 'varchar')
    .addUniqueConstraint('game_players_game_id_player_id_unique', ['game_id', 'player_id'])
    .execute();

  await db.schema
    .createIndex('game_players_game_id_index')
    .on('game_players')
    .column('game_id')
    .execute();

  await db.schema
    .createIndex('game_players_player_id_index')
    .on('game_players')
    .column('player_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('game_players').execute();
}