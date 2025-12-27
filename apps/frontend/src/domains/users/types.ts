import type { UserId } from '@kernel/ids';

interface User {
  id: UserId;
  username: string;
  user_key: string;
  created_at: string;
}

export type { User };
