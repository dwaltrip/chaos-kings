// import {
// 	DummyDriver,
// 	PostgresAdapter,
// 	PostgresIntrospector,
// 	PostgresQueryCompiler,
// } from 'kysely'
import { defineConfig } from 'kysely-ctl';
import { db } from '../src/db.ts';

export default defineConfig({
  kysely: db,
	// dialect: 'pg',
	//   migrations: {
	//     migrationFolder: "migrations",
	//   },
	//   plugins: [],
	//   seeds: {
	//     seedFolder: "seeds",
	//   }
});
