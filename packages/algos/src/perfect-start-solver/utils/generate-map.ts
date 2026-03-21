import { GameGrid, Square } from '@core/types';
import { generateGameMapV2 } from '@core/terrain-generation';
import { isBlankSquare, isGeneralSquare, isMountainSquare } from '@core/square';

interface MapConfig {
  height: number;
  width: number;
}

function generateMap({ width, height }: MapConfig) {
  const seed = Date.now();
  const { grid } = generateGameMapV2({
    size: { width, height },
    numPlayers: 1,
    minGeneralDistance: 0,
    seed,
  });
  return gridToText(grid);
}

function gridToText(grid: GameGrid): string {
  const stringifySquare = (square: Square) => {
    if (isBlankSquare(square)) return '.';
    if (isGeneralSquare(square)) return 'G';
    if (isMountainSquare(square)) return 'M';

    throw new Error(`invalid square: ${JSON.stringify(square || {})}`);
  };

  return grid
    .map((row) => {
      return row.map(stringifySquare).join('');
    })
    .join('\n');
}

export type { MapConfig };
export { generateMap };
