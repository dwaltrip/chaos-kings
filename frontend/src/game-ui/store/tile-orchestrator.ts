import type { Direction } from '@core/types';
import type { BoardState } from '@core/types';
import { getTileStore } from '@/game-ui/store/tile-store-registry';

class TileOrchestrator {
  updateQueuedDirections(queuedDirectionsByCoord: Map<string, Set<Direction>>) {
    queuedDirectionsByCoord.forEach((directions, key) => {
      const [x, y] = key.split(',').map(Number);
      const coord = { x, y };
      const store = getTileStore(coord);
      store.getState().updateQueuedDirections(directions);
    });
  }

  updateTileSquares(boardState: BoardState) {
    if (!boardState?.grid) return;

    const { grid } = boardState;
    // TODO: make helper for iterating over all coords in board
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        const store = getTileStore({ x, y });
        store.getState().updateSquare(grid[y][x]);
      }
    }
  }

  clearAllQueuedDirections(boardState: BoardState) {
    if (!boardState?.grid) return;
    const { grid } = boardState;
    // TODO: make helper for iterating over all coords in board
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        const store = getTileStore({ x, y });
        store.getState().updateQueuedDirections(new Set());
      }
    }
  }
}

const tileOrchestrator = new TileOrchestrator();

export { tileOrchestrator };
