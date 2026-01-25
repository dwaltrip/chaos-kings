import { UserId } from '@kernel/ids';
import { makeRoomId } from '@protocol/domains/system';

function buildSandboxRoomId(userId: UserId) {
  return makeRoomId('sandbox', `user-${userId}`);
}

export { buildSandboxRoomId };
