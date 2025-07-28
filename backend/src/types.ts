// https://kysely.dev/docs/getting-started#types

import { UsersTable } from '@/user/user.db';

interface Database {
  users: UsersTable
}

export {
  Database,
  UsersTable,
};
