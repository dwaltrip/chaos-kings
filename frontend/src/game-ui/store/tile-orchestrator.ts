import type { Direction } from '@core/types';
import type { BoardState } from '@core/types';
import { getTileStore } from '@/game-ui/store/tile-store-registry';

class TileOrchestrator {
  updateQueuedMoves(queuedMovesByCoord: Map<string, Set<Direction>>) {
    queuedMovesByCoord.forEach((moves, key) => {
      const [x, y] = key.split(',').map(Number);
      const coord = { x, y };
      const store = getTileStore(coord);
      store.getState().updateQueuedMoves(moves);
    });
  }

  updateTileSquares(boardState: BoardState) {
    if (!boardState?.grid) return;

    const { grid } = boardState;
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        const store = getTileStore({ x, y });
        store.getState().updateSquare(grid[y][x]);
      }
    }
  }
}

const tileOrchestrator = new TileOrchestrator();

export { tileOrchestrator };
