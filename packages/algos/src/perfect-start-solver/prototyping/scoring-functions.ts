import type { Coord } from '@core/types';

import { TileType, Board } from '@/core-next/flat-board';
import type { FlatBoard } from '@/core-next/flat-board';

import { ALL_DIRECTIONS } from './helpers';
import type { ScoringFn } from './types';

// -- Shared helpers -----------------------------------------------------------

function generalArmyCount(board: FlatBoard, generalCoord: Coord): number {
  const idx = generalCoord.y * board.width + generalCoord.x;
  return board.units[idx];
}

// Multi-source BFS from all blank tiles. Returns distance-to-nearest-blank
// for every cell. Mountains get Infinity. Blank tiles get 0.
function buildDistanceToBlankMap(board: FlatBoard): number[] {
  const n = board.width * board.height;
  const dist = new Array<number>(n);
  const queue: number[] = [];

  for (let i = 0; i < n; i++) {
    if (board.types[i] === TileType.BLANK) {
      dist[i] = 0;
      queue.push(i);
    } else {
      dist[i] = Infinity;
    }
  }

  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const d = dist[idx];

    for (const dir of ALL_DIRECTIONS) {
      const ni = Board.neighbor(board, idx, dir);
      if (ni === -1) continue;
      if (dist[ni] <= d + 1) continue;
      if (board.types[ni] === TileType.MOUNTAIN) continue;

      dist[ni] = d + 1;
      queue.push(ni);
    }
  }

  return dist;
}

// Estimates how many tiles the current armies could capture via chain moves.
function capturableCount(board: FlatBoard): number {
  const distMap = buildDistanceToBlankMap(board);
  const n = board.width * board.height;

  let capturable = 0;
  for (let i = 0; i < n; i++) {
    if (board.owners[i] !== 0) continue;
    const excess = board.units[i] - 1;
    if (excess <= 0) continue;
    const d = distMap[i];
    if (d === Infinity) continue;
    capturable += Math.max(0, excess - d);
  }

  return capturable;
}

// Like capturableCount but uses excess² to reward concentrated armies.
// A tile with 6 excess scores 36, vs six tiles with 1 excess scoring 6.
function superlinearCapCount(board: FlatBoard): number {
  const distMap = buildDistanceToBlankMap(board);
  const n = board.width * board.height;

  let score = 0;
  for (let i = 0; i < n; i++) {
    if (board.owners[i] !== 0) continue;
    const excess = board.units[i] - 1;
    if (excess <= 0) continue;
    const d = distMap[i];
    if (d === Infinity) continue;
    const effective = Math.max(0, excess - d);
    score += effective * effective;
  }

  return score;
}

// Count unique blank tiles adjacent to player territory.
function countFrontier(board: FlatBoard): number {
  const n = board.width * board.height;
  const seen = new Uint8Array(n);
  let frontier = 0;

  for (let i = 0; i < n; i++) {
    if (board.owners[i] !== 0) continue;

    for (const dir of ALL_DIRECTIONS) {
      const ni = Board.neighbor(board, i, dir);
      if (ni === -1) continue;
      if (seen[ni]) continue;
      seen[ni] = 1;
      if (board.types[ni] === TileType.BLANK) {
        frontier++;
      }
    }
  }

  return frontier;
}

// -- Factory functions --------------------------------------------------------

function makeLandOnlyScorer(): ScoringFn {
  return (board) => board.stats.landCounts[0];
}

interface CapturableOpts {
  landWeight?: number; // default 1
  capWeight?: number; // default 1
  superlinear?: boolean; // use excess² instead of excess - dist
}

function makeCapturableScorer(opts?: CapturableOpts): ScoringFn {
  const landW = opts?.landWeight ?? 1;
  const capW = opts?.capWeight ?? 1;
  const sup = opts?.superlinear ?? false;
  return (board) => {
    const land = board.stats.landCounts[0];
    const cap = sup ? superlinearCapCount(board) : capturableCount(board);
    return land * landW + cap * capW;
  };
}

interface FrontierOpts {
  landWeight: number;
}

function makeFrontierScorer(opts: FrontierOpts): ScoringFn {
  return (board) => board.stats.landCounts[0] * opts.landWeight + countFrontier(board);
}

// -- General-army-aware factories ---------------------------------------------

interface LandGenOpts {
  generalCoord: Coord;
  landWeight?: number; // default 1
  genWeight: number;
}

function makeLandGenScorer(opts: LandGenOpts): ScoringFn {
  const { generalCoord, genWeight } = opts;
  const landW = opts.landWeight ?? 1;
  return (board) => {
    const land = board.stats.landCounts[0];
    const gen = generalArmyCount(board, generalCoord);
    return land * landW + gen * genWeight;
  };
}

interface CapGenOpts {
  generalCoord: Coord;
  landWeight?: number; // default 5
  genWeight: number;
}

function makeCapGenScorer(opts: CapGenOpts): ScoringFn {
  const { generalCoord, genWeight } = opts;
  const landW = opts.landWeight ?? 5;
  return (board) => {
    const land = board.stats.landCounts[0];
    const gen = generalArmyCount(board, generalCoord);
    return land * landW + capturableCount(board) + gen * genWeight;
  };
}

interface FrontierGenOpts {
  generalCoord: Coord;
  landWeight?: number; // default 2
  genWeight: number;
}

function makeFrontierGenScorer(opts: FrontierGenOpts): ScoringFn {
  const { generalCoord, genWeight } = opts;
  const landW = opts.landWeight ?? 2;
  return (board) => {
    const land = board.stats.landCounts[0];
    const gen = generalArmyCount(board, generalCoord);
    return land * landW + countFrontier(board) + gen * genWeight;
  };
}

// -- Time-aware general-army factories ----------------------------------------

interface TimeAwareCapGenOpts {
  generalCoord: Coord;
  landWeight?: number; // default 5
  genWeight: number;
  maxTicks: number;
}

// Gen credit decays linearly: full value at tick 0, zero at maxTicks.
function makeTimeAwareCapGenScorer(opts: TimeAwareCapGenOpts): ScoringFn {
  const { generalCoord, genWeight, maxTicks } = opts;
  const landW = opts.landWeight ?? 5;
  return (board, tick) => {
    const land = board.stats.landCounts[0];
    const cap = capturableCount(board);
    const ticksLeft = maxTicks - tick;
    const gen = generalArmyCount(board, generalCoord) * (ticksLeft / maxTicks);
    return land * landW + cap + gen * genWeight;
  };
}

export {
  makeLandOnlyScorer,
  makeCapturableScorer,
  makeFrontierScorer,
  makeLandGenScorer,
  makeCapGenScorer,
  makeFrontierGenScorer,
  makeTimeAwareCapGenScorer,
};
