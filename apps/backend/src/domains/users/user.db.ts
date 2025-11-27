import { ColumnType, Generated } from 'kysely';

/* 
  "Deprecated" User interface from common common/types/user.ts
  Now moved platform/domains/users/types-deprecated.ts

  interface UserFromCommon {
    id: number;
    username: string;
    user_key: string;
    created_at: string;
    session_id?: string;
  }
*/

interface UsersTable {
  id: Generated<number>;
  username: string;
  user_key: string;
  created_at: ColumnType<Date, string | undefined, never>;
}

export { UsersTable };
