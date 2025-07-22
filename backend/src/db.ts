import { Database } from '@/types';
import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';

const dialect = new PostgresDialect({
  pool: new Pool({
    database: 'fullstack_ws_demo_game',
    host: 'localhost',
    user: 'postgres',
    port: 5432,
    max: 10,
  })
})

const db = new Kysely<Database>({
  dialect,
});

export { db };
