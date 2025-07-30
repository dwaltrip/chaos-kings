// import {
// 	DummyDriver,
// 	PostgresAdapter,
// 	PostgresIntrospector,
// 	PostgresQueryCompiler,
// } from 'kysely'
import { defineConfig } from 'kysely-ctl';
import { db } from '../src/services/db.ts';

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
