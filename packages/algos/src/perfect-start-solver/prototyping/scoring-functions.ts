import { Direction } from '@core/types';

import { TileType, NO_OWNER, Board } from '@/core-next/flat-board';
import type { FlatBoard } from '@/core-next/flat-board';

import { ALL_DIRECTIONS } from './helpers';
import type { ScoringFn } from './types';

const landOnly: ScoringFn = (board: FlatBoard): number => {
  return board.stats.landCounts[0];
};

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

// Score = currentLand + sum(max(0, excess - dist)) for each player tile
// Estimates how many tiles the current armies could capture via chain moves.
const capturableTiles: ScoringFn = (board: FlatBoard): number => {
  const land = board.stats.landCounts[0];
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

  return land + capturable;
};

// Same as capturableTiles but weights actual land 5x so capturing is
// always preferred over hoarding armies near blanks.
const landWeightedCapturable: ScoringFn = (board: FlatBoard): number => {
  const land = board.stats.landCounts[0];
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

  return land * 5 + capturable;
};

// Count unique blank tiles adjacent to player territory.
function countFrontier(board: FlatBoard): number {
  const n = board.width * board.height;
  const seen = new Uint8Array(n); // 0 = unseen, 1 = seen
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

function makeFrontierScorer(landWeight: number): ScoringFn {
  return (board: FlatBoard): number => {
    const land = board.stats.landCounts[0];
    return land * landWeight + countFrontier(board);
  };
}

export { landOnly, capturableTiles, landWeightedCapturable, makeFrontierScorer };
