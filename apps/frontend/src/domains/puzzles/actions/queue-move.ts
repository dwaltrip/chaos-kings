import type { Coord, Direction } from '@core/types';
import { Board } from '@core/board';

import { getTileStore } from '@/domains/games/stores/tile-store-registry';
import { usePuzzleStore } from '@/domains/puzzles/stores/puzzle-store';
import { puzzlesWsEffects } from '@/domains/puzzles/ws-effects';

function queueMove(source: Coord, direction: Direction): void {
  const { board, actions } = usePuzzleStore.getState();
  const { addQueuedMove, setSelectedTile } = actions;
  if (!board) return;

  // Basic validation - only check bounds and blocked destination (matches gameplay)
  if (!Board.canMove(board, source, direction)) {
    return;
  }

  // Immediately add to local queue for instant arrow feedback
  addQueuedMove({ sourceCoord: source, direction });

  // Update tile store for per-tile subscriptions (optimistic)
  const tileStore = getTileStore(source);
  tileStore.getState().addQueuedDirection(direction);

  // Move selected tile in the direction of the move
  const newSelected = Board.applyDirection(source, direction);
  setSelectedTile(newSelected);

  // Send to server
  puzzlesWsEffects.sendMoveRequest(source, direction);
}

export { queueMove };
