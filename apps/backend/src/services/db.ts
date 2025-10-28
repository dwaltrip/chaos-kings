import { Database } from '@/types';
import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';

const connectionString = process.env.DATABASE_URL;
const pool = connectionString
  ? new Pool({ connectionString })
  : new Pool({
      database: process.env.PGDATABASE || 'generals_v2',
      host: process.env.PGHOST || 'localhost',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD,
      port: Number(process.env.PGPORT) || 5432,
      max: 10,
    });

const dialect = new PostgresDialect({
  pool,
});

const db = new Kysely<Database>({
  dialect,
});

export { db };
