import { Board, type FlatBoard } from '@core-next/flat-board';

import type { Blob } from './types';

interface GenBlobOptions {
  board: FlatBoard;
  start: number;
  pathCount: number;
  maxLen: number;
  minLen: number;
  // Per-path overlap budget (applied to every path after the first): how
  // many tiles in already-claimed blob territory the walk may step through
  // across its full length. Not necessarily contiguous or at the start —
  // the walk can randomly choose to overlap at any step. The first path
  // always has budget 0 (the blob is empty when it runs).
  maxOverlap: number;
  rng: () => number;
}

// Seeded PRNG (Mulberry32) — small, deterministic, sufficient for blob
// generation. Not cryptographic.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickPathLengths(pathCount: number, maxLen: number, minLen: number): number[] {
  if (pathCount <= 0) return [];
  if (pathCount === 1) return [maxLen];
  const lens: number[] = [];
  for (let i = 0; i < pathCount; i++) {
    // Linear interpolation from maxLen (i=0) down to minLen (i=pathCount-1).
    const t = i / (pathCount - 1);
    lens.push(Math.round(maxLen - t * (maxLen - minLen)));
  }
  return lens;
}

// Generate a single non-backtracking random walk of up to `length` tiles
// starting at `start`, avoiding mountains and tiles already in the current
// walk. Tiles in `blocked` (previously-claimed territory) can be stepped
// through up to `overlap` times total in the walk — not necessarily at the
// start, anywhere the walk randomly chooses one. The walk truncates early
// if no legal neighbors remain. Returns tiles visited (including `start`).
function randomWalk(
  board: FlatBoard,
  start: number,
  length: number,
  blocked: Set<number>,
  overlap: number,
  rng: () => number,
): number[] {
  if (length < 1) return [];
  const visited = new Set<number>();
  const walk: number[] = [start];
  visited.add(start);
  let current = start;
  let overlapRemaining = overlap;
  for (let step = 1; step < length; step++) {
    const options: number[] = [];
    const neighbors = [
      Board.neighborUp(board, current),
      Board.neighborDown(board, current),
      Board.neighborLeft(board, current),
      Board.neighborRight(board, current),
    ];
    for (const n of neighbors) {
      if (n < 0) continue;
      if (!Board.isPassable(board, n)) continue;
      if (visited.has(n)) continue;
      // Blocked tiles are only legal if we still have overlap budget.
      if (blocked.has(n) && overlapRemaining <= 0) continue;
      options.push(n);
    }
    if (options.length === 0) break;
    const next = options[Math.floor(rng() * options.length)];
    if (blocked.has(next)) overlapRemaining--;
    walk.push(next);
    visited.add(next);
    current = next;
  }
  return walk;
}

// Generate a blob as the union of `pathCount` non-backtracking random walks
// from a shared `start`. Each walk after the first has `maxOverlap` budget
// to step through tiles already claimed by earlier walks. Path lengths
// descend linearly from maxLen to minLen.
function genBlob(opts: GenBlobOptions): Blob {
  const { board, start, pathCount, maxLen, minLen, maxOverlap, rng } = opts;
  if (!Board.isPassable(board, start)) {
    throw new Error(`start tile ${start} is not passable`);
  }

  const tiles = new Set<number>();
  tiles.add(start);

  const lens = pickPathLengths(pathCount, maxLen, minLen);
  for (let i = 0; i < lens.length; i++) {
    // Each walk avoids tiles from previous walks *except* the start itself
    // (which is shared as the hub). First walk has no overlap budget; the
    // blob is empty so there's nothing to overlap with anyway.
    const blocked = new Set(tiles);
    blocked.delete(start);
    const overlap = i === 0 ? 0 : maxOverlap;
    const walk = randomWalk(board, start, lens[i], blocked, overlap, rng);
    for (const t of walk) tiles.add(t);
  }

  let mask = 0n;
  for (const t of tiles) mask |= 1n << BigInt(t);

  return { tiles, mask };
}

export { genBlob, mulberry32 };
export type { GenBlobOptions };
