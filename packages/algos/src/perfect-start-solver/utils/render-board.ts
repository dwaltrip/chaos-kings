import { Board, TileType, type FlatBoard } from '@core-next/flat-board';

// Crop to an auto-computed bounding box around a set of interesting tiles,
// with optional padding. Useful for focusing the view on a blob + its lanes.
interface CropByTiles {
  kind: 'tiles';
  tiles: Iterable<number>;
  padding?: number;
}

// Crop to an explicit rectangular region.
interface CropByRegion {
  kind: 'region';
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

type CropSpec = CropByTiles | CropByRegion;

interface RenderBoardOptions {
  // Override character for a given tile. Return null to fall through to defaults.
  tileChar?: (idx: number) => string | null;
  crop?: CropSpec;
}

function resolveCrop(board: FlatBoard, crop: CropSpec | undefined) {
  if (crop == null) {
    return { xMin: 0, xMax: board.width - 1, yMin: 0, yMax: board.height - 1 };
  }
  if (crop.kind === 'region') {
    return {
      xMin: Math.max(0, crop.xMin),
      xMax: Math.min(board.width - 1, crop.xMax),
      yMin: Math.max(0, crop.yMin),
      yMax: Math.min(board.height - 1, crop.yMax),
    };
  }
  const padding = crop.padding ?? 1;
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const idx of crop.tiles) {
    const { x, y } = Board.toXY(board, idx);
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  if (!isFinite(xMin)) {
    // Empty tile set — fall back to full board.
    return { xMin: 0, xMax: board.width - 1, yMin: 0, yMax: board.height - 1 };
  }
  return {
    xMin: Math.max(0, xMin - padding),
    xMax: Math.min(board.width - 1, xMax + padding),
    yMin: Math.max(0, yMin - padding),
    yMax: Math.min(board.height - 1, yMax + padding),
  };
}

function defaultChar(board: FlatBoard, idx: number): string {
  return board.types[idx] === TileType.MOUNTAIN ? '#' : '.';
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

export type { RenderBoardOptions, CropSpec };
export { renderBoard };
