// Can pocket boards achieve 24 captures? Test manually-designed burst patterns.
//
// Usage: npx tsx src/perfect-start-solver/research-spike-1/experiments/3.22-4-pocket-11x11-manual-patterns.ts

import { Direction } from '@core/types';

import { Board } from '@/core-next/flat-board';

import {
  getBurstInfosFromSpecs,
  type BurstSpec,
} from '../../custom-algo-1/get-burst-info';
import { type BoardCtx, loadBoardCtx } from '../../utils/board';
import { buildBursts, type BurstPath } from '../../utils/burst-pattern';

const MAX_TICKS = 50;
const TARGET_CAPTURES = 24;
const MAX_BURST = 12;
const TIMING_PROBE_MAX = 60;

const L = Direction.LEFT;
const U = Direction.UP;
const D = Direction.DOWN;

// ── Helpers (board-independent) ──

// Build direction sequence: prefix (truncated if needed) + fill direction repeated.
// If totalMoves < prefix.length, uses only the first totalMoves directions from prefix.
function makeDirs(prefix: Direction[], fill: Direction, totalMoves: number): Direction[] {
  if (totalMoves <= prefix.length) return prefix.slice(0, totalMoves);
  return [...prefix, ...Array(totalMoves - prefix.length).fill(fill)];
}

function tileLabel(ctx: BoardCtx, idx: number): string {
  const { x, y } = Board.toXY(ctx.flatBoard, idx);
  return `(${y},${x})`;
}

// ── Solution checking ──

function checkSolution(
  ctx: BoardCtx,
  bursts: BurstPath[],
): {
  valid: boolean;
  reason?: string;
  specs?: BurstSpec[];
  minTicks?: number;
} {
  const withCaptures = bursts
    .map((b) => ({
      captures: b.tiles.length - b.overlap,
      moves: b.tiles.length,
    }))
    .filter((s) => s.moves > 0);

  const specs: BurstSpec[] = [...withCaptures].sort((a, b) => a.captures - b.captures);

  const totalCap = specs.reduce((s, sp) => s + sp.captures, 0);
  if (totalCap !== TARGET_CAPTURES) {
    return { valid: false, reason: `total captures ${totalCap} != ${TARGET_CAPTURES}` };
  }

  // Check no tile captured twice.
  const captured = new Set<number>();
  for (const burst of bursts) {
    for (let i = burst.overlap; i < burst.tiles.length; i++) {
      if (captured.has(burst.tiles[i])) {
        return {
          valid: false,
          reason: `tile ${tileLabel(ctx, burst.tiles[i])} captured twice`,
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

// ── Search ──

function searchPattern(ctx: BoardCtx, name: string, pattern: PatternFn, nBursts: number) {
  console.log(`\n## ${name}`);
  console.log(`  Variable bursts: ${nBursts}, each 0..${MAX_BURST}`);

  const probe = pattern(ctx, Array(nBursts).fill(MAX_BURST));
  if (probe) {
    const burstDescs = probe.map((b, i) => {
      if (i < nBursts) return `B${i + 1}=0..${MAX_BURST}`;
      return `B${i + 1}=fixed(${b.tiles.length})`;
    });
    console.log(`  Bursts: ${burstDescs.join(', ')}`);
  }

  const solutions: string[] = [];
  const timingByTick: Record<number, number> = {};
  const failures = { geometry: 0, captures: 0, timing: 0, overlap: 0, other: 0 };

  function enumerate(depths: number[]) {
    if (depths.length === nBursts) {
      const bursts = pattern(ctx, depths);
      if (!bursts) {
        failures.geometry++;
        return;
      }
      const result = checkSolution(ctx, bursts);
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
      enumerate([...depths, len]);
    }
  }

  enumerate([]);

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

// A pattern takes a BoardCtx + burst lengths → BurstPath[] | null.
type PatternFn = (ctx: BoardCtx, lengths: number[]) => BurstPath[] | null;

interface PatternDef {
  name: string;
  fn: PatternFn;
  nBursts: number;
}

function runBoard(boardName: string, patterns: PatternDef[]) {
  const ctx = loadBoardCtx(boardName);
  console.log(`\n# ${boardName}: Manual pattern search for ${TARGET_CAPTURES} captures`);
  console.log(
    `General at ${tileLabel(ctx, ctx.generalPos)}, MAX_TICKS=${MAX_TICKS}, MAX_BURST=${MAX_BURST}`,
  );

  for (const p of patterns) {
    searchPattern(ctx, p.name, p.fn, p.nBursts);
  }
}

const patternsPocket1: PatternDef[] = [
  {
    name: 'Idea 1',
    fn: (ctx, [l1, l2, l3, l4]) =>
      buildBursts(ctx, [
        // B1: LEFT×4, UP×rest (overlap=0)
        makeDirs([L, L, L, L], U, l1),
        // B2: LEFT×all (overlap=4, re-traverses B1's first 4 left moves)
        makeDirs([], L, l2),
        // B3: LEFT, DOWN, LEFT×rest (overlap=1)
        makeDirs([L, D], L, l3),
        // B4: DOWN×rest (overlap=0)
        makeDirs([], D, l4),
      ]),
    nBursts: 4,
  },
  {
    name: 'Idea 2',
    fn: (ctx, [l1, l2, l3, l4]) =>
      buildBursts(ctx, [
        makeDirs([L, L, L, L], U, l1),
        makeDirs([], L, l2),
        makeDirs([L, D], L, l3),
        makeDirs([], D, l4),
      ]),
    nBursts: 4,
  },
  {
    name: 'Idea 3',
    fn: (ctx, [l1, l2, l3, l4]) =>
      buildBursts(ctx, [
        makeDirs([L, L, L, L], U, l1),
        makeDirs([L, L, D, L, L, L], U, l2),
        makeDirs([L, D, D], L, l3),
        makeDirs([], D, l4),
      ]),
    nBursts: 4,
  },
  {
    name: 'Idea 4',
    fn: (ctx, [l1, l2, l3, l4, l5]) =>
      buildBursts(ctx, [
        makeDirs([L, L, L, L], U, l1),
        makeDirs([L, L, L, D, L, L], U, l2),
        makeDirs([L, L, D, D], L, l3),
        makeDirs([L], D, l4),
        makeDirs([], D, l5),
      ]),
    nBursts: 5,
  },
  {
    name: 'Idea 5',
    fn: (ctx, [l1, l2, l3, l4, l5]) =>
      buildBursts(ctx, [
        makeDirs([L, L, L, L], U, l1),
        makeDirs([L, L, L, L, L], U, l2),
        makeDirs([L, L, D], L, l3),
        makeDirs([L, D, D], L, l4),
        makeDirs([], D, l5),
      ]),
    nBursts: 5,
  },
];

const patternsPocket2: PatternDef[] = [
  {
    name: 'Pocket 2 - Idea 1',
    fn: (ctx, [l1, l2, l3, l4, l5]) =>
      buildBursts(ctx, [
        makeDirs([L, L, L], L, l1),
        makeDirs([L, L, L], U, l2),
        makeDirs([L, L, D], L, l3),
        makeDirs([L], D, l4),
        makeDirs([], D, l5),
      ]),
    nBursts: 5,
  },
  {
    name: 'Pocket 2 - Idea 2',
    fn: (ctx, [l1, l2, l3, l4, l5, l6]) =>
      buildBursts(ctx, [
        makeDirs([L, L, L], U, l1),
        makeDirs([L, L, L, L], U, l2),
        makeDirs([L, L, L, D, L, L], U, l3),
        makeDirs([L, L, D, D], L, l4),
        makeDirs([L], D, l5),
        makeDirs([], D, l6),
      ]),
    nBursts: 6,
  },
];

runBoard('pocket-11x11', patternsPocket1);
runBoard('pocket-2-11x11', patternsPocket2);
