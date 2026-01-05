import { UserId } from '@kernel/ids';

import { ConnectionId } from '@/ws-lib';
import { systemActions } from '@/domains/system/actions';
import { buildPuzzleRoomId } from '@/domains/puzzles/utils';

// buildPuzzleRoomId
class PuzzleManager {
  constructor() {}
}

function setupAndStartPuzzle(userId: UserId, connectionId: ConnectionId) {
  console.log('setupAndStartPuzzle -- userId:', userId);
  const room = buildPuzzleRoomId(userId);
  systemActions.joinRoom({ roomId: room, userId, connectionId });
}

export { setupAndStartPuzzle };
