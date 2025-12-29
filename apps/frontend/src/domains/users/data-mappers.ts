/*
TODO: where should this go
For `games` I put this type of logic in @platform
Also, what name do I want? deserialize? data-mapper? something else?
*/
import { UserId } from '@kernel/ids';
import type { UserDTO, User } from '@/domains/users/types';

function toUser(data: UserDTO): User {
  return {
    id: UserId(data.id),
    username: data.username,
    userKey: data.user_key,
    createdAt: new Date(data.created_at),
  };
}

export { toUser };
