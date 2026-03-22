// Can pocket-11x11 achieve 24 captures? Test two manually-designed burst patterns.
//
// Usage: npx tsx src/perfect-start-solver/research-spike-1/experiments/3.22-4-pocket-11x11-manual-patterns.ts

import { Direction } from '@core/types';

import { Board, TileType } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { makeBoard } from '../../test-boards';
import {
  getBurstInfosFromSpecs,
  type BurstSpec,
} from '../../custom-algo-1/get-burst-info';

const MAX_TICKS = 50;
const TARGET_CAPTURES = 24;
const MAX_BURST = 12;

const L = Direction.LEFT;
const U = Direction.UP;
const D = Direction.DOWN;

const testBoard = makeBoard('pocket-11x11');
const flatBoard = fromBoardState(testBoard.board, 1);
const generalPos = Board.toIndex(
  flatBoard,
  testBoard.generalCoord.x,
  testBoard.generalCoord.y,
);

// ── Helpers ──

// Walk a path from the general following direction sequence.
// Returns tile indices (excluding general), or null if path is invalid.
function walkPath(dirs: Direction[]): number[] | null {
  const tiles: number[] = [];
  let pos = generalPos;
  const visited = new Set<number>([pos]);

  for (const dir of dirs) {
    const next = Board.neighbor(flatBoard, pos, dir);
    if (!Board.isValidIndex(flatBoard, next)) return null;
    if (flatBoard.types[next] === TileType.MOUNTAIN) return null;
    if (visited.has(next)) return null;
    tiles.push(next);
    visited.add(next);
    pos = next;
  }
  return tiles;
}

// Build direction sequence: prefix + fill direction repeated.
function makeDirs(prefix: Direction[], fill: Direction, totalMoves: number): Direction[] {
  if (totalMoves < prefix.length) return [];
  return [...prefix, ...Array(totalMoves - prefix.length).fill(fill)];
}

// Tile index → (row, col) string for display.
function tileLabel(idx: number): string {
  const { x, y } = Board.toXY(flatBoard, idx);
  return `(${y},${x})`;
}

// ── Solution checking ──

interface BurstPath {
  tiles: number[];
  overlap: number;
  dirs: Direction[];
}

function checkSolution(bursts: BurstPath[]): {
  valid: boolean;
  reason?: string;
  specs?: BurstSpec[];
} {
  // Build specs — execution order is smallest captures first (departs first).
  const withCaptures = bursts.map((b, i) => ({
    idx: i,
    captures: b.tiles.length - b.overlap,
    moves: b.tiles.length,
    overlap: b.overlap,
  }));

  // Sort by captures ascending for execution order (fewest troops needed first).
  const sorted = [...withCaptures].sort((a, b) => a.captures - b.captures);
  const specs: BurstSpec[] = sorted.map((s) => ({
    captures: s.captures,
    moves: s.moves,
  }));

  // Check total captures.
  const totalCap = specs.reduce((s, sp) => s + sp.captures, 0);
  if (totalCap !== TARGET_CAPTURES) {
    return { valid: false, reason: `total captures ${totalCap} != ${TARGET_CAPTURES}` };
  }

  // Check timing.
  const infos = getBurstInfosFromSpecs(specs, MAX_TICKS);
  if (!infos) {
    return { valid: false, reason: 'timing: exceeds max ticks' };
  }

  // Check overlap tiles are captured by prior bursts (in burst order, not execution order).
  const capturedSoFar = new Set<number>();
  for (const burst of bursts) {
    for (let i = 0; i < burst.overlap; i++) {
      if (!capturedSoFar.has(burst.tiles[i])) {
        return {
          valid: false,
          reason: `overlap tile ${tileLabel(burst.tiles[i])} not yet captured`,
        };
      }
    }
    for (let i = burst.overlap; i < burst.tiles.length; i++) {
      if (capturedSoFar.has(burst.tiles[i])) {
        return {
          valid: false,
          reason: `tile ${tileLabel(burst.tiles[i])} captured twice`,
        };
      }
      capturedSoFar.add(burst.tiles[i]);
    }
  }

  return { valid: true, specs };
}

// ── Pattern definitions ──

// Each pattern is a function from burst lengths → BurstPath[] | null.
// Returns null if any path is geometrically invalid.

type PatternFn = (lengths: number[]) => BurstPath[] | null;

// Idea 1:
//   B1: LEFT×4, UP×rest (overlap=0)
//   B2: LEFT×all (overlap=4, re-traverses B1's first 4 left moves)
//   B3: LEFT, DOWN, LEFT×rest (overlap=1)
//   B4: DOWN×rest (overlap=0)
const idea1: PatternFn = ([l1, l2, l3, l4]) => {
  const d1 = makeDirs([L, L, L, L], U, l1);
  const d2 = makeDirs([], L, l2);
  const d3 = makeDirs([L, D], L, l3);
  const d4 = makeDirs([], D, l4);

  if (d1.length === 0 || d2.length === 0 || d3.length === 0 || d4.length === 0)
    return null;

  const t1 = walkPath(d1);
  const t2 = walkPath(d2);
  const t3 = walkPath(d3);
  const t4 = walkPath(d4);

  if (!t1 || !t2 || !t3 || !t4) return null;

  return [
    { tiles: t1, overlap: 0, dirs: d1 },
    { tiles: t2, overlap: 4, dirs: d2 },
    { tiles: t3, overlap: 1, dirs: d3 },
    { tiles: t4, overlap: 0, dirs: d4 },
  ];
};

// Idea 2:
//   B1: LEFT×4, UP×rest (overlap=0)
//   B2: LEFT×2, DOWN, LEFT×rest (overlap=2)
//   B3: LEFT, DOWN×2, LEFT×rest (overlap=1)
//   B4: DOWN×2 (overlap=0, fixed)
const idea2: PatternFn = ([l1, l2, l3]) => {
  const d1 = makeDirs([L, L, L, L], U, l1);
  const d2 = makeDirs([L, L, D], L, l2);
  const d3 = makeDirs([L, D, D], L, l3);
  const d4 = [D, D] as Direction[];

  if (d1.length === 0 || d2.length === 0 || d3.length === 0) return null;

  const t1 = walkPath(d1);
  const t2 = walkPath(d2);
  const t3 = walkPath(d3);
  const t4 = walkPath(d4);

  if (!t1 || !t2 || !t3 || !t4) return null;

  return [
    { tiles: t1, overlap: 0, dirs: d1 },
    { tiles: t2, overlap: 2, dirs: d2 },
    { tiles: t3, overlap: 1, dirs: d3 },
    { tiles: t4, overlap: 0, dirs: d4 },
  ];
};

// ── Search ──

function searchPattern(name: string, pattern: PatternFn, nBursts: number) {
  console.log(`\n## ${name}`);

  const solutions: string[] = [];
  const timingFailures: string[] = [];
  const failures = { geometry: 0, captures: 0, timing: 0, overlap: 0, other: 0 };

  // Enumerate all length combos. Each burst length: 1..MAX_BURST.
  function enumerate(depths: number[], remaining: number) {
    if (depths.length === nBursts) {
      const bursts = pattern(depths);
      if (!bursts) {
        failures.geometry++;
        return;
      }
      const result = checkSolution(bursts);
      if (result.valid) {
        const caps = bursts.map((b) => b.tiles.length - b.overlap);
        const overlaps = bursts.map((b) => b.overlap);
        const moves = bursts.map((b) => b.tiles.length);
        solutions.push(`  lengths=[${moves}] captures=[${caps}] overlaps=[${overlaps}]`);
      } else {
        const r = result.reason || '';
        if (r.includes('captures')) failures.captures++;
        else if (r.includes('timing')) {
          failures.timing++;
          const caps = bursts.map((b) => b.tiles.length - b.overlap);
          const overlaps = bursts.map((b) => b.overlap);
          const moves = bursts.map((b) => b.tiles.length);
          timingFailures.push(
            `  lengths=[${moves}] captures=[${caps}] overlaps=[${overlaps}]`,
          );
        } else if (r.includes('overlap') || r.includes('captured twice'))
          failures.overlap++;
        else failures.other++;
      }
      return;
    }
    for (let len = 1; len <= MAX_BURST; len++) {
      enumerate([...depths, len], remaining);
    }
  }

  enumerate([], nBursts);

  if (solutions.length > 0) {
    console.log(`  FOUND ${solutions.length} valid solution(s)!`);
    for (const s of solutions) console.log(s);
  } else {
    console.log(`  No solutions found.`);
  }
  console.log(`  Failures: ${JSON.stringify(failures)}`);
  if (timingFailures.length > 0) {
    console.log(`  Timing failures (geometry OK, captures=24, but >50 ticks):`);
    for (const s of timingFailures) console.log(s);
  }
}

// ── Run ──

console.log('# pocket-11x11: Manual pattern search for 24 captures');
console.log(
  `General at ${tileLabel(generalPos)}, MAX_TICKS=${MAX_TICKS}, MAX_BURST=${MAX_BURST}`,
);

searchPattern('Idea 1 (4 variable bursts)', idea1, 4);
searchPattern('Idea 2 (3 variable + fixed B4=DOWN×2)', idea2, 3);
