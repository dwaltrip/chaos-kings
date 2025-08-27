import type { Coord, Movement } from '@core/types';
import { coordsEqual } from '@core/utils/coordinate-utils';
import { isGeneralSquare } from '@core/square';
import type { BoardState } from '@core/types';
import { getTileStore } from './tile-store-registry';

export class TileOrchestrator {
  // Phase 1: Update simple state across tiles
  updateSelectedTile(selectedCoord: Coord | null, allCoords: Coord[]) {
    allCoords.forEach((coord) => {
      const store = getTileStore(coord);
      const isSelected = selectedCoord
        ? coordsEqual(selectedCoord, coord)
        : false;
      store.getState().updateSelection(isSelected);
    });
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
  updateGeneralStatus(boardState: BoardState) {
    if (!boardState?.grid) return;

    const { grid } = boardState;
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        const coord = { x, y };
        const square = grid[y][x];
        const store = getTileStore(coord);
        const isGeneral = isGeneralSquare(square);
        store.getState().updateGeneral(isGeneral);
      }
    }
  }

  // Helper to get all board coordinates from board state
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

  // Convenience method to update selection with board context
  updateSelectedTileFromBoard(
    selectedCoord: Coord | null,
    boardState: BoardState,
  ) {
    const allCoords = this.getAllBoardCoords(boardState);
    this.updateSelectedTile(selectedCoord, allCoords);
  }
}

export const tileOrchestrator = new TileOrchestrator();
