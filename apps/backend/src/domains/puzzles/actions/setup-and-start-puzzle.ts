import { UserId } from '@kernel/ids';

import { ConnectionId } from '@/ws-lib';
import { systemActions } from '@/domains/system/actions';
import { buildPuzzleRoomId } from '@/domains/puzzles/utils';
import { User } from '@platform/domains/users/types-deprecated';
import { GameState } from '@core/types';
import { makeBlankMap } from '@core/map/make-blank-map';
import { makeGeneralSquare } from '@core/map/make-squares';
import { userRepository } from '@/domains/users/user-repository';

interface Puzzle {
  user: User;
  gameState: GameState;
  type: string;
}

// buildPuzzleRoomId
class PuzzleManager {
  constructor() {}
}

async function setupAndStartPuzzle(userId: UserId, connectionId: ConnectionId) {
  console.log('setupAndStartPuzzle -- userId:', userId);

  const room = buildPuzzleRoomId(userId);
  systemActions.joinRoom({ roomId: room, userId, connectionId });

  // TODO: do
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new Error(`[setupAndStartPuzzle] Cannot find user: ${userId}`);
  }
  const puzzle = createPuzzle(user);
}

function buildMap() {
  const grid = makeBlankMap(21, 21);
  grid[10][10] = makeGeneralSquare({ x: 10, y: 10 }, 0);
  return grid;
}

const PUZZLE_TYPE_BEST_START = 'best-start';

function createPuzzle(user: User): Puzzle {
  const grid = buildMap();
  const board = {
    grid,
    size: { height: grid.length, width: grid[0].length },
  };
  return {
    user,
    gameState: {
      tick: 0, // TODO: what does this start as???
      board,
    },
    type: PUZZLE_TYPE_BEST_START,
  };
}

export { setupAndStartPuzzle };
