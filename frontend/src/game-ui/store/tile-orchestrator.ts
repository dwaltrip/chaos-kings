import type { Coord, Movement, Square } from '@core/types';
import type { BoardState } from '@core/types';
import { getTileStore } from '@/game-ui/store/tile-store-registry';

export class TileOrchestrator {
  updateTileSquare(coord: Coord, square: Square) {
    const store = getTileStore(coord);
    store.getState().updateSquare(square);
  }

  updateQueuedMoves(queuedMovesByCoord: Map<string, Set<Movement>>) {
    queuedMovesByCoord.forEach((moves, key) => {
      const [x, y] = key.split(',').map(Number);
      const coord = { x, y };
      const store = getTileStore(coord);
      store.getState().updateQueuedMoves(moves);
    });

    // Clear moves for tiles not in the map
    // Note: In Phase 1, we'll be conservative and only update tiles that have moves
    // In Phase 2, we might need to clear all tiles when moves are reset
  }

  // Phase 1: Update general status across all tiles when board state changes
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

  // Helper to get all board coordinates from board state
  // TODO: this might be dead code now
  /*
  private getAllBoardCoords(boardState: BoardState): Coord[] {
    if (!boardState?.grid) return [];

    const coords: Coord[] = [];
    for (let y = 0; y < boardState.grid.length; y++) {
      for (let x = 0; x < boardState.grid[y].length; x++) {
        coords.push({ x, y });
      }
    }
    return coords;
  }
  */
}

export const tileOrchestrator = new TileOrchestrator();
