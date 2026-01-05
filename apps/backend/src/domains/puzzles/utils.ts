import { UserId } from '@kernel/ids';
import { makeRoomId } from '@protocol/domains/system';

function buildPuzzleRoomId(userId: UserId) {
  return makeRoomId('puzzles', `user-${userId}`);
}

export { buildPuzzleRoomId };
