import { CellState } from '@core/terrain-generation/types';
import type { Grid } from '@core/terrain-generation/grid';
import type { GameGrid, Square, Size2d, PlayerSquare } from '@core/types';
import { SquareType } from '@core/types';

interface ConversionResult {
  grid: GameGrid;
  size: Size2d;
}

// TODO: Move this out of terrain-generation module??
// I wanted the terrain generation to be self-contained.
// Maybe move to @core/grid-utils or something?
function convertToGameGrid(
  terrainGrid: Grid,
  generals?: PlayerSquare[],
): ConversionResult {
  const dimensions = terrainGrid.getDimensions();
  const gameGrid: GameGrid = [];

  // Initialize the GameGrid with proper structure
  for (let y = 0; y < dimensions.height; y++) {
    gameGrid.push([]);
    for (let x = 0; x < dimensions.width; x++) {
      const coord = { x, y };
      const cellState = terrainGrid.getCell(coord);

      // Convert terrain grid cell to game square
      const square: Square = {
        coord,
        type:
          cellState === CellState.OBSTACLE
            ? SquareType.MOUNTAIN
            : SquareType.BLANK,
      };

      gameGrid[y][x] = square;
    }
  }

  // Place generals on the grid if provided
  if (generals) {
    for (const general of generals) {
      const { x, y } = general.coord;
      gameGrid[y][x] = general;
    }
  }

  return {
    grid: gameGrid,
    size: dimensions,
  };
}

export type { ConversionResult };
export { convertToGameGrid };
