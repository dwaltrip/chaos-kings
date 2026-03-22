import { Direction } from '@core/types';

import { Board, TileType } from '@/core-next/flat-board';

import type { BurstInfo } from '../custom-algo-1/get-burst-info';
import { printTickByTick, simulateSpecs, type FullBurstSpec } from './simulate-verbose';
import type { BoardCtx } from './board';

// ── Types ──

export interface BurstSegment {
  dir: Direction;
  count: number;
}

export interface BurstPattern {
  armies: number;
  segments: BurstSegment[];
}

export interface BurstPath {
  tiles: number[];
  overlap: number;
  dirs: Direction[];
}

export interface PatternAnalysis {
  bursts: BurstPath[];
  specs: FullBurstSpec[];
  burstInfos: BurstInfo[];
  totalCaptures: number;
  endTick: number;
}

// Re-export for convenience.
export { type BoardCtx, loadBoardCtx } from './board';

// ── Direction building ──

export function patternToDirs(patterns: BurstPattern[]): Direction[][] {
  return patterns.map((p) => {
    const dirs: Direction[] = [];
    for (const seg of p.segments) {
      for (let i = 0; i < seg.count; i++) dirs.push(seg.dir);
    }
    return dirs;
  });
}

// ── Path walking ──

function walkPath(ctx: BoardCtx, dirs: Direction[]): number[] | null {
  const tiles: number[] = [];
  let pos = ctx.generalPos;
  const visited = new Set<number>([pos]);

  for (const dir of dirs) {
    const next = Board.neighbor(ctx.flatBoard, pos, dir);
    if (!Board.isValidIndex(ctx.flatBoard, next)) return null;
    if (ctx.flatBoard.types[next] === TileType.MOUNTAIN) return null;
    if (visited.has(next)) return null;
    tiles.push(next);
    visited.add(next);
    pos = next;
  }
  return tiles;
}

// ── Burst building ──

export function buildBursts(ctx: BoardCtx, dirArrays: Direction[][]): BurstPath[] | null {
  const bursts: BurstPath[] = [];
  const capturedSoFar = new Set<number>();

  for (const dirs of dirArrays) {
    if (dirs.length === 0) {
      bursts.push({ tiles: [], overlap: 0, dirs });
      continue;
    }
    const tiles = walkPath(ctx, dirs);
    if (!tiles) return null;

    let overlap = 0;
    while (overlap < tiles.length && capturedSoFar.has(tiles[overlap])) {
      overlap++;
    }

    for (let i = overlap; i < tiles.length; i++) {
      capturedSoFar.add(tiles[i]);
    }

    bursts.push({ tiles, overlap, dirs });
  }
  return bursts;
}

// ── Full analysis ──

export function analyzePattern(
  ctx: BoardCtx,
  patterns: BurstPattern[],
  maxTicks: number,
): PatternAnalysis | null {
  const dirArrays = patternToDirs(patterns);
  const bursts = buildBursts(ctx, dirArrays);
  if (!bursts) return null;

  const specs: FullBurstSpec[] = [];
  for (let i = 0; i < bursts.length; i++) {
    const b = bursts[i];
    if (b.tiles.length === 0) continue;
    specs.push({
      moves: b.tiles.length,
      captures: b.tiles.length - b.overlap,
      troopsNeeded: patterns[i].armies,
    });
  }

  const burstInfos = simulateSpecs(specs, maxTicks);
  if (!burstInfos) return null;

  const totalCaptures = specs.reduce((s, sp) => s + sp.captures, 0);
  const endTick = burstInfos[burstInfos.length - 1].endTick;

  return { bursts, specs, burstInfos, totalCaptures, endTick };
}

// ── Printing ──

const DIR_LABELS: Record<Direction, string> = {
  [Direction.UP]: 'U',
  [Direction.DOWN]: 'D',
  [Direction.LEFT]: 'L',
  [Direction.RIGHT]: 'R',
};

export function printAnalysis(
  result: PatternAnalysis,
  opts?: { verbose?: boolean },
): void {
  console.log(`Total captures: ${result.totalCaptures}, end tick: ${result.endTick}`);
  console.log();

  let specIdx = 0;
  for (let i = 0; i < result.bursts.length; i++) {
    const b = result.bursts[i];
    if (b.tiles.length === 0) continue;
    const info = result.burstInfos[specIdx];
    specIdx++;
    const dirStr = b.dirs.map((d) => DIR_LABELS[d]).join('');
    const captures = b.tiles.length - b.overlap;
    const overlapStr = b.overlap > 0 ? `, overlap ${b.overlap}` : '';
    console.log(
      `  Burst ${i + 1}: ${dirStr} — ${b.tiles.length} moves, ${captures} captures${overlapStr}` +
        ` (ticks ${info.startTick}–${info.endTick})`,
    );
  }

  if (opts?.verbose) {
    console.log();
    console.log('Tick-by-tick:');
    printTickByTick(result.specs, result.endTick);
  }
}
