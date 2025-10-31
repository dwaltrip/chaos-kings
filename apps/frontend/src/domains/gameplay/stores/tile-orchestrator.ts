import type { Direction } from '@core/types';
import type { BoardState } from '@core/types';
import { deserializeCoord } from '@core/utils/coordinate-utils';
import { Board } from '@core/board';

import { getTileStore } from '@/domains/gameplay/stores/tile-store-registry';

class TileOrchestrator {
  updateQueuedDirections(queuedDirectionsByCoord: Map<string, Set<Direction>>) {
    queuedDirectionsByCoord.forEach((directions, key) => {
      const coord = deserializeCoord(key);
      const store = getTileStore(coord);
      store.getState().updateQueuedDirections(directions);
    });
  }

  updateTileSquares(board: BoardState) {
    Board.forEachCoord(board, (coord, square) => {
      const store = getTileStore(coord);
      store.getState().updateSquare(square);
    });
  }

  clearAllQueuedDirections(board: BoardState) {
    Board.forEachCoord(board, (coord) => {
      const store = getTileStore(coord);
      store.getState().updateQueuedDirections(new Set());
    });
  }
}

const tileOrchestrator = new TileOrchestrator();

export { tileOrchestrator };
