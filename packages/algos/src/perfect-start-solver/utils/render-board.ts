import { TileType, type FlatBoard } from '@core-next/flat-board';

import { type CropSpec, resolveCrop } from './crop-board';

interface RenderBoardOptions {
  // Override character for a given tile. Return null to fall through to defaults.
  tileChar?: (idx: number) => string | null;
  crop?: CropSpec;
}

function defaultChar(board: FlatBoard, idx: number): string {
  return board.types[idx] === TileType.MOUNTAIN ? '#' : '·';
}

function renderBoard(board: FlatBoard, options: RenderBoardOptions = {}): string {
  const { xMin, xMax, yMin, yMax } = resolveCrop(board, options.crop);
  const tileChar = options.tileChar;

  const rows: string[] = [];
  for (let y = yMin; y <= yMax; y++) {
    const cells: string[] = [];
    for (let x = xMin; x <= xMax; x++) {
      const idx = y * board.width + x;
      const custom = tileChar ? tileChar(idx) : null;
      cells.push(custom ?? defaultChar(board, idx));
    }
    rows.push(cells.join(' '));
  }
  return rows.join('\n');
}

export type { RenderBoardOptions };
export { renderBoard };
