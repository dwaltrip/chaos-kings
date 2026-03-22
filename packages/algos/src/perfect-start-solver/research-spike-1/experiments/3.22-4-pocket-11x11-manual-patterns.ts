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

// Build direction sequence: prefix (truncated if needed) + fill direction repeated.
// If totalMoves < prefix.length, uses only the first totalMoves directions from prefix.
function makeDirs(prefix: Direction[], fill: Direction, totalMoves: number): Direction[] {
  if (totalMoves <= prefix.length) return prefix.slice(0, totalMoves);
  return [...prefix, ...Array(totalMoves - prefix.length).fill(fill)];
}

// Tile index → (row, col) string for display.
function tileLabel(idx: number): string {
  const { x, y } = Board.toXY(flatBoard, idx);
  return `(${y},${x})`;
}

// ── Burst building ──

interface BurstPath {
  tiles: number[];
  overlap: number;
  dirs: Direction[];
}

// Walk all direction sequences, auto-compute overlap from prior bursts.
// Returns null if any path is geometrically invalid.
function buildBursts(dirArrays: Direction[][]): BurstPath[] | null {
  const bursts: BurstPath[] = [];
  const capturedSoFar = new Set<number>();

  for (const dirs of dirArrays) {
    if (dirs.length === 0) {
      bursts.push({ tiles: [], overlap: 0, dirs });
      continue;
    }
    const tiles = walkPath(dirs);
    if (!tiles) return null;

    // Count leading tiles already captured = overlap.
    let overlap = 0;
    while (overlap < tiles.length && capturedSoFar.has(tiles[overlap])) {
      overlap++;
    }

    // New captures start after overlap.
    for (let i = overlap; i < tiles.length; i++) {
      capturedSoFar.add(tiles[i]);
    }

    bursts.push({ tiles, overlap, dirs });
  }
  return bursts;
}

// ── Solution checking ──

const TIMING_PROBE_MAX = 60; // check up to this many ticks for "almost" solutions

function checkSolution(bursts: BurstPath[]): {
  valid: boolean;
  reason?: string;
  specs?: BurstSpec[];
  minTicks?: number; // minimum ticks needed (if geometry + captures OK)
} {
  // Build specs — execution order is smallest captures first (departs first).
  const withCaptures = bursts
    .map((b) => ({
      captures: b.tiles.length - b.overlap,
      moves: b.tiles.length,
    }))
    .filter((s) => s.moves > 0);

  // Sort by captures ascending for execution order (fewest troops needed first).
  const specs: BurstSpec[] = [...withCaptures].sort((a, b) => a.captures - b.captures);

  // Check total captures.
  const totalCap = specs.reduce((s, sp) => s + sp.captures, 0);
  if (totalCap !== TARGET_CAPTURES) {
    return { valid: false, reason: `total captures ${totalCap} != ${TARGET_CAPTURES}` };
  }

  // Check no tile captured by two different bursts (overlap tiles are excluded
  // from captures, so just check that new-capture tiles don't collide).
  const captured = new Set<number>();
  for (const burst of bursts) {
    for (let i = burst.overlap; i < burst.tiles.length; i++) {
      if (captured.has(burst.tiles[i])) {
        return {
          valid: false,
          reason: `tile ${tileLabel(burst.tiles[i])} captured twice`,
        };
      }
      captured.add(burst.tiles[i]);
    }
  }

  // Check timing — try at MAX_TICKS first, then probe up to TIMING_PROBE_MAX.
  const infos = getBurstInfosFromSpecs(specs, MAX_TICKS);
  if (infos) {
    return { valid: true, specs, minTicks: infos[infos.length - 1].endTick };
  }

  // Find minimum ticks needed.
  for (let t = MAX_TICKS + 1; t <= TIMING_PROBE_MAX; t++) {
    const probe = getBurstInfosFromSpecs(specs, t);
    if (probe) {
      return {
        valid: false,
        reason: 'timing: exceeds max ticks',
        specs,
        minTicks: probe[probe.length - 1].endTick,
      };
    }
  }

  return { valid: false, reason: `timing: exceeds ${TIMING_PROBE_MAX} ticks`, specs };
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
const idea1: PatternFn = ([l1, l2, l3, l4]) =>
  buildBursts([
    makeDirs([L, L, L, L], U, l1),
    makeDirs([], L, l2),
    makeDirs([L, D], L, l3),
    makeDirs([], D, l4),
  ]);

// Idea 2:
//   B1: LEFT×4, UP×rest (overlap=0)
//   B2: LEFT×2, DOWN, LEFT×rest (overlap=2)
//   B3: LEFT, DOWN×2, LEFT×rest (overlap=1)
//   B4: DOWN×rest (overlap=0)
const idea2: PatternFn = ([l1, l2, l3, l4]) =>
  buildBursts([
    makeDirs([L, L, L, L], U, l1),
    makeDirs([L, L, D], L, l2),
    makeDirs([L, D, D], L, l3),
    makeDirs([], D, l4),
  ]);

const idea3: PatternFn = ([l1, l2, l3, l4]) =>
  buildBursts([
    makeDirs([L, L, L, L], U, l1),
    makeDirs([L, L, D, L, L, L], U, l2),
    makeDirs([L, D, D], L, l3),
    makeDirs([], D, l4),
  ]);

const idea4: PatternFn = ([l1, l2, l3, l4, l5]) =>
  buildBursts([
    makeDirs([L, L, L, L], U, l1),
    makeDirs([L, L, L, D, L, L], U, l2),
    makeDirs([L, L, D, D], L, l3),
    makeDirs([L], D, l4),
    makeDirs([], D, l5),
  ]);

const idea5: PatternFn = ([l1, l2, l3, l4, l5]) =>
  buildBursts([
    makeDirs([L, L, L, L], U, l1),
    makeDirs([L, L, L, L, L], U, l2),
    makeDirs([L, L, D], L, l3),
    makeDirs([L, D, D], L, l4),
    makeDirs([], D, l5),
  ]);

// ── Search ──

function searchPattern(name: string, pattern: PatternFn, nBursts: number) {
  console.log(`\n## ${name}`);
  console.log(`  Variable bursts: ${nBursts}, each 0..${MAX_BURST}`);

  // Probe pattern at max lengths to discover total burst count + fixed bursts.
  const probe = pattern(Array(nBursts).fill(MAX_BURST));
  if (probe) {
    const burstDescs = probe.map((b, i) => {
      if (i < nBursts) return `B${i + 1}=0..${MAX_BURST}`;
      return `B${i + 1}=fixed(${b.tiles.length})`;
    });
    console.log(`  Bursts: ${burstDescs.join(', ')}`);
  }

  const solutions: string[] = [];
  const timingByTick: Record<number, number> = {}; // tick → count of almost-solutions
  const failures = { geometry: 0, captures: 0, timing: 0, overlap: 0, other: 0 };

  // Enumerate all length combos. Each variable burst length: 0..MAX_BURST.
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
          if (result.minTicks) {
            timingByTick[result.minTicks] = (timingByTick[result.minTicks] || 0) + 1;
          }
        } else if (r.includes('overlap') || r.includes('captured twice'))
          failures.overlap++;
        else failures.other++;
      }
      return;
    }
    for (let len = 0; len <= MAX_BURST; len++) {
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
  const tickCounts = Object.entries(timingByTick)
    .map(([t, n]) => [Number(t), n] as [number, number])
    .filter(([t]) => t <= MAX_TICKS + 10)
    .sort((a, b) => a[0] - b[0]);
  if (tickCounts.length > 0) {
    console.log(`  Almost-solutions (ticks 51-${MAX_TICKS + 10}):`);
    for (const [tick, count] of tickCounts) {
      console.log(`    ${tick} ticks: ${count}`);
    }
  }
}

// ── Run ──

console.log('# pocket-11x11: Manual pattern search for 24 captures');
console.log(
  `General at ${tileLabel(generalPos)}, MAX_TICKS=${MAX_TICKS}, MAX_BURST=${MAX_BURST}`,
);

searchPattern('Idea 1 (4 variable bursts)', idea1, 4);
searchPattern('Idea 2 (3 variable + fixed B4=DOWN×2)', idea2, 4);
searchPattern('Idea 3', idea3, 4);
searchPattern('Idea 4', idea4, 5);
searchPattern('Idea 5', idea5, 5);
