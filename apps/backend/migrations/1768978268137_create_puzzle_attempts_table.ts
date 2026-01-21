import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('puzzle_attempts')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) => col.notNull())
    .addForeignKeyConstraint('puzzle_attempts_user_id_fkey', ['user_id'], 'users', ['id'])
    .addColumn('puzzle_type', 'varchar(50)', (col) =>
      col.notNull().defaultTo('best_start'),
    )
    .addColumn('land_count', 'integer', (col) => col.notNull())
    .addColumn('army_count', 'integer', (col) => col.notNull())
    .addColumn('config', 'jsonb', (col) => col.notNull())
    .addColumn('map_seed', 'bigint', (col) => col.notNull())
    .addColumn('final_board_state', 'jsonb')
    .addColumn('move_history', 'jsonb', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .execute();

  await db.schema
    .createIndex('puzzle_attempts_leaderboard_idx')
    .on('puzzle_attempts')
    .columns(['puzzle_type', 'land_count', 'army_count'])
    .execute();

  await db.schema
    .createIndex('puzzle_attempts_user_idx')
    .on('puzzle_attempts')
    .columns(['user_id', 'created_at'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('puzzle_attempts_user_idx').execute();
  await db.schema.dropIndex('puzzle_attempts_leaderboard_idx').execute();
  await db.schema.dropTable('puzzle_attempts').execute();
}
