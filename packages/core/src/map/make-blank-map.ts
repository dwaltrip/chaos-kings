import { range } from '@utils/range';

import type { GameGrid } from '@core/types';
import { blankSquare } from '@core/square';

function makeBlankMap(height: number, width: number): GameGrid {
  return range(height).map((y) => range(width).map((x) => blankSquare({ x, y })));
}

export { makeBlankMap };
