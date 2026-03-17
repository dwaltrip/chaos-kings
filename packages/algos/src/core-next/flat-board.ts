import { Direction } from '@core/types';

// --- Type constants ---
// These numeric values are protocol — they show up in wire format, accessors,
// and mutation API. Keep them stable. Value 2 is reserved for NEUTRAL_CITY.
const TileType = {
  BLANK: 0,
  MOUNTAIN: 1,
  // NEUTRAL_CITY: 2,  — reserved, not yet implemented
  ARMY: 3,
  GENERAL: 4,
  PLAYER_CITY: 5,
} as const;
type TileType = (typeof TileType)[keyof typeof TileType];

const NO_OWNER = -1;

// --- Data structures ---

interface FlatBoard {
  types: Uint8Array;
  owners: Int8Array;
  units: Int32Array;
  width: number;
  height: number;
  // Maintained incrementally by processStep and Board mutation API.
  // NOTE: re-evaluate whether stats belong on the board during port to main game.
  stats: {
    landCounts: number[];
    armyCounts: number[];
  };
  // Indices of tiles that produce at the general rate (generals + player cities).
  // Maintained by processStep, setTile, and recomputeProdTiles.
  prodTiles: number[];
}

// Returned by ergonomic accessors. Fresh object per call.
interface Tile {
  type: TileType;
  owner: number;
  units: number;
  x: number;
  y: number;
  idx: number;
}

// --- Clone ---

function cloneBoard(board: FlatBoard): FlatBoard {
  return {
    types: board.types.slice(),
    owners: board.owners.slice(),
    units: board.units.slice(),
    width: board.width,
    height: board.height,
    stats: {
      landCounts: [...board.stats.landCounts],
      armyCounts: [...board.stats.armyCounts],
    },
    prodTiles: [...board.prodTiles],
  };
}

// Copy source board data into an existing target board (avoids allocation).
// Target must have the same dimensions and playerCount as source.
function copyInto(target: FlatBoard, source: FlatBoard): void {
  target.types.set(source.types);
  target.owners.set(source.owners);
  target.units.set(source.units);
  for (let i = 0; i < source.stats.landCounts.length; i++) {
    target.stats.landCounts[i] = source.stats.landCounts[i];
    target.stats.armyCounts[i] = source.stats.armyCounts[i];
  }
  // Copy prodTiles — reuse target array slots where possible
  const len = source.prodTiles.length;
  target.prodTiles.length = len;
  for (let i = 0; i < len; i++) {
    target.prodTiles[i] = source.prodTiles[i];
  }
}

// --- Create ---

function createBoard(width: number, height: number, playerCount: number): FlatBoard {
  const n = width * height;
  const types = new Uint8Array(n); // defaults to 0 = BLANK
  const owners = new Int8Array(n);
  owners.fill(NO_OWNER);
  const units = new Int32Array(n); // defaults to 0

  return {
    types,
    owners,
    units,
    width,
    height,
    stats: {
      landCounts: new Array(playerCount).fill(0),
      armyCounts: new Array(playerCount).fill(0),
    },
    prodTiles: [],
  };
}

// --- Index helpers ---

function toIndex(board: FlatBoard, x: number, y: number): number {
  return y * board.width + x;
}

function toXY(board: FlatBoard, idx: number): { x: number; y: number } {
  const x = idx % board.width;
  const y = (idx - x) / board.width;
  return { x, y };
}

function isValidIndex(board: FlatBoard, idx: number): boolean {
  return idx >= 0 && idx < board.width * board.height;
}

function isValidCoord(board: FlatBoard, x: number, y: number): boolean {
  return x >= 0 && x < board.width && y >= 0 && y < board.height;
}

// --- Navigation ---

function neighborUp(board: FlatBoard, idx: number): number {
  return idx >= board.width ? idx - board.width : -1;
}

function neighborDown(board: FlatBoard, idx: number): number {
  return idx + board.width < board.width * board.height ? idx + board.width : -1;
}

function neighborLeft(board: FlatBoard, idx: number): number {
  return idx % board.width > 0 ? idx - 1 : -1;
}

function neighborRight(board: FlatBoard, idx: number): number {
  return idx % board.width < board.width - 1 ? idx + 1 : -1;
}

function neighbor(board: FlatBoard, idx: number, dir: Direction): number {
  switch (dir) {
    case Direction.UP:
      return neighborUp(board, idx);
    case Direction.DOWN:
      return neighborDown(board, idx);
    case Direction.LEFT:
      return neighborLeft(board, idx);
    case Direction.RIGHT:
      return neighborRight(board, idx);
  }
}

// --- Ergonomic read API ---

function getTile(board: FlatBoard, x: number, y: number): Tile {
  const idx = toIndex(board, x, y);
  return getTileByIdx(board, idx);
}

function getTileByIdx(board: FlatBoard, idx: number): Tile {
  const x = idx % board.width;
  const y = (idx - x) / board.width;
  return {
    type: board.types[idx] as TileType,
    owner: board.owners[idx],
    units: board.units[idx],
    x,
    y,
    idx,
  };
}

function isPassable(board: FlatBoard, idx: number): boolean {
  return board.types[idx] !== TileType.MOUNTAIN;
}

function isPlayerTile(tile: Tile): boolean {
  return tile.owner !== NO_OWNER;
}

// --- Ergonomic iteration ---
// NOTE: forEachTile allocates a fresh Tile object per cell. For a 20x20 board
// that's 400 allocations per call. Fine for game code, but avoid in hot paths.
// If perf iteration is needed, use direct array access or consider a callback
// with primitives: (idx, type, owner, units) => void.
function forEachTile(board: FlatBoard, fn: (tile: Tile) => void): void {
  const n = board.width * board.height;
  for (let i = 0; i < n; i++) {
    fn(getTileByIdx(board, i));
  }
}

function mapTiles<T>(board: FlatBoard, mapFn: (tile: Tile) => T): T[] {
  const mapped = [];
  const n = board.width * board.height;
  for (let i = 0; i < n; i++) {
    mapped.push(mapFn(getTileByIdx(board, i)));
  }
  return mapped;
}

function mapTiles2d<T>(board: FlatBoard, mapFn: (tile: Tile) => T): T[][] {
  const gridMapped = [];
  for (let y = 0; y < board.height; y++) {
    const row = [];
    for (let x = 0; x < board.width; x++) {
      row.push(mapFn(getTile(board, x, y)));
    }
    gridMapped.push(row);
  }
  return gridMapped;
}

// --- Ergonomic mutation API ---
// These maintain stats. Use these for non-perf-sensitive code.
// processStep uses direct array writes + its own stat maintenance internally.

function isProdType(type: TileType): boolean {
  return type === TileType.GENERAL || type === TileType.PLAYER_CITY;
}

function setTile(
  board: FlatBoard,
  idx: number,
  type: TileType,
  owner: number,
  units: number,
): void {
  const prevType = board.types[idx] as TileType;
  const prevOwner = board.owners[idx];
  const prevUnits = board.units[idx];

  // Remove old stats
  if (prevOwner !== NO_OWNER) {
    board.stats.landCounts[prevOwner]--;
    board.stats.armyCounts[prevOwner] -= prevUnits;
  }

  board.types[idx] = type;
  board.owners[idx] = owner;
  board.units[idx] = units;

  // Add new stats
  if (owner !== NO_OWNER) {
    board.stats.landCounts[owner]++;
    board.stats.armyCounts[owner] += units;
  }

  // Maintain prodTiles
  const wasProd = isProdType(prevType);
  const isProd = isProdType(type);
  if (!wasProd && isProd) {
    board.prodTiles.push(idx);
  } else if (wasProd && !isProd) {
    const i = board.prodTiles.indexOf(idx);
    if (i !== -1) {
      board.prodTiles[i] = board.prodTiles[board.prodTiles.length - 1];
      board.prodTiles.pop();
    }
  }
}

function addUnits(board: FlatBoard, idx: number, delta: number): void {
  board.units[idx] += delta;
  const owner = board.owners[idx];
  if (owner !== NO_OWNER) {
    board.stats.armyCounts[owner] += delta;
  }
}

function recomputeProdTiles(board: FlatBoard): void {
  board.prodTiles.length = 0;
  const n = board.width * board.height;
  for (let i = 0; i < n; i++) {
    const t = board.types[i];
    if (t === TileType.GENERAL || t === TileType.PLAYER_CITY) {
      board.prodTiles.push(i);
    }
  }
}

// Recompute stats from scratch (for init or validation)
function recomputeStats(board: FlatBoard): void {
  const { landCounts, armyCounts } = board.stats;
  landCounts.fill(0);
  armyCounts.fill(0);
  const n = board.width * board.height;
  for (let i = 0; i < n; i++) {
    const owner = board.owners[i];
    if (owner !== NO_OWNER) {
      landCounts[owner]++;
      armyCounts[owner] += board.units[i];
    }
  }
}

// --- Board namespace ---

const Board = {
  // Create / clone / copy
  create: createBoard,
  clone: cloneBoard,
  copyInto,

  // Index helpers
  toIndex,
  toXY,
  isValidIndex,
  isValidCoord,

  // Navigation
  neighbor,
  neighborUp,
  neighborDown,
  neighborLeft,
  neighborRight,

  // Read
  getTile,
  getTileByIdx,
  isPassable,
  isPlayerTile,

  // Iteration
  forEachTile,
  mapTiles,
  mapTiles2d,

  // Mutation
  setTile,
  addUnits,

  // Stats
  recomputeStats,
  recomputeProdTiles,
};

export { TileType, NO_OWNER };
export type { FlatBoard, Tile };
export { cloneBoard, copyInto, Board };
