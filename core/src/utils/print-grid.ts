import { isBlankSquare, isGeneralSquare, isMountainSquare } from '@core/square';
import { GameGrid } from '@core/types';

function printGrid(grid: GameGrid) {
  const size = { width: grid[0].length, height: grid.length };
  console.log(`---- Grid (${size.width}x${size.height}) ----`);

  for (let y = 0; y < size.height; y++) {
    console.log(
      grid[y]
        .map((cell) => {
          if (isBlankSquare(cell)) {
            return '.';
          }
          if (isMountainSquare(cell)) {
            return '#';
          }
          if (isGeneralSquare(cell)) {
            return 'G';
          }
        })
        .join(''),
    );
  }

  console.log();
}

export { printGrid };
