// https://kysely.dev/docs/getting-started#types

import { UsersTable } from '@/users/user.tables';

interface Database {
  users: UsersTable
}

export {
  Database,
  UsersTable,
};
