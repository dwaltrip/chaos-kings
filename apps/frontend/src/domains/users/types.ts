import type { UserId } from '@kernel/ids';

interface User {
  id: UserId;
  username: string;
  userKey: string;
  createdAt: Date;
}

interface UserDTO {
  id: number;
  username: string;
  user_key: string;
  created_at: string;
}

export type { User, UserDTO };
