import { Database } from '@/types';
import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';

const testDialect = new PostgresDialect({
  pool: new Pool({
    database: 'generals_v2_test',
    host: 'localhost',
    user: 'postgres',
    port: 5432,
    max: 10,
  })
});

const testDb = new Kysely<Database>({
  dialect: testDialect,
});

export { testDb };

