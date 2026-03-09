import { Board } from '@core/board';
import { Direction } from '@core/types';
import type { Movement } from '@core/types';
import { serializeCoord } from '@core/utils/coordinate-utils';

import type { QueuedDirs } from './tile-derived-state';
import type { BoardStoreState, DerivedState } from './types';

function buildQueuedMovesMap(moves: Movement[]): Map<string, QueuedDirs> {
  const map = new Map<string, QueuedDirs>();
  for (const move of moves) {
    const key = serializeCoord(move.sourceCoord);
    let dirs = map.get(key);
    if (!dirs) {
      dirs = { up: false, down: false, left: false, right: false };
      map.set(key, dirs);
    }
    if (move.direction === Direction.UP) dirs.up = true;
    else if (move.direction === Direction.DOWN) dirs.down = true;
    else if (move.direction === Direction.LEFT) dirs.left = true;
    else if (move.direction === Direction.RIGHT) dirs.right = true;
  }
  return map;
}

function deriveBoardState(state: BoardStoreState): DerivedState {
  const { source } = state;
  const allVisible = source.status === 'ended' || source.currentPlayerIndex === null;
  const visibleSquares =
    allVisible || !source.board
      ? new Set<string>()
      : Board.getVisibleSquares(source.board, source.currentPlayerIndex!);
  const queuedMovesMap = buildQueuedMovesMap(source.queuedMoves);
  return { visibleSquares, allVisible, queuedMovesMap };
}

export { deriveBoardState, buildQueuedMovesMap };
