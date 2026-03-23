// Prefix enumeration and analysis utilities.
// A "prefix at depth D" is a non-backtracking path of length D from the general
// (general excluded — same convention as PathEntry).

import { type FlatBoard } from '@/core-next/flat-board';

import { genPathsDP } from '../custom-algo-1/gen-paths';
import {
  buildPathEntries,
  type PathEntry,
  type PathEntriesByLen,
} from '../custom-algo-1/path-search';
import { getWalkableNeighbors } from '../utils/board-graph';

// ── Prefix enumeration ──

// Generate all path entries up to maxPathLen, and extract prefixes at each depth.
function enumeratePrefixes(
  board: FlatBoard,
  generalPos: number,
  maxPrefixDepth: number,
  maxPathLen: number,
): { entriesByLen: PathEntriesByLen; prefixesByDepth: Map<number, PathEntry[]> } {
  const genPaths = genPathsDP(board, generalPos, maxPathLen + 1);
  const entriesByLen = buildPathEntries(genPaths);

  const prefixesByDepth = new Map<number, PathEntry[]>();
  for (let d = 1; d <= maxPrefixDepth; d++) {
    prefixesByDepth.set(d, entriesByLen.get(d) ?? []);
  }

  return { entriesByLen, prefixesByDepth };
}

// ── Prefix keys ──

// Canonical string key for a prefix — the first `depth` tiles joined by comma.
function prefixKey(tiles: number[], depth: number): string {
  return tiles.slice(0, depth).join(',');
}

// ── Fan-out ──

// For a given (prefixDepth, targetLen), build a map from prefix key → count of
// target-length paths that share that prefix.
function buildFanoutMap(
  entriesByLen: PathEntriesByLen,
  prefixDepth: number,
  targetLen: number,
): Map<string, number> {
  const counts = new Map<string, number>();
  const entries = entriesByLen.get(targetLen);
  if (!entries) return counts;

  for (const entry of entries) {
    const key = prefixKey(entry.tiles, prefixDepth);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

interface FanoutStats {
  depth: number;
  targetLen: number;
  prefixCount: number;
  totalPaths: number; // total paths at targetLen (= sum of all fan-outs)
  min: number;
  median: number;
  max: number;
  mean: number;
  dead: number; // prefixes with zero fan-out
}

function computeFanoutStats(
  prefixes: PathEntry[],
  fanoutMap: Map<string, number>,
  depth: number,
  targetLen: number,
  totalPaths: number,
): FanoutStats {
  const values: number[] = [];
  for (const p of prefixes) {
    values.push(fanoutMap.get(prefixKey(p.tiles, depth)) ?? 0);
  }

  const sorted = [...values].sort((a, b) => a - b);
  const dead = sorted.filter((v) => v === 0).length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mid = Math.floor(sorted.length / 2);
  const med =
    sorted.length === 0
      ? 0
      : sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];

  return {
    depth,
    targetLen,
    prefixCount: prefixes.length,
    totalPaths,
    min: sorted[0] ?? 0,
    median: med,
    max: sorted[sorted.length - 1] ?? 0,
    mean: prefixes.length > 0 ? sum / prefixes.length : 0,
    dead,
  };
}

// ── Tip properties ──

interface TipStats {
  depth: number;
  prefixCount: number;
  // degree → count (walkable degree of the tip tile)
  degreeDistribution: Map<number, number>;
  // freeNeighbors → count (walkable neighbors of tip not in the prefix path or general)
  freeNeighborDistribution: Map<number, number>;
}

function computeTipStats(
  board: FlatBoard,
  generalPos: number,
  prefixes: PathEntry[],
  depth: number,
): TipStats {
  const degDist = new Map<number, number>();
  const freeDist = new Map<number, number>();

  for (const p of prefixes) {
    const tip = p.tiles[depth - 1];
    const neighbors = getWalkableNeighbors(board, tip);
    const deg = neighbors.length;
    degDist.set(deg, (degDist.get(deg) ?? 0) + 1);

    const pathSet = new Set([generalPos, ...p.tiles]);
    const free = neighbors.filter((nb) => !pathSet.has(nb)).length;
    freeDist.set(free, (freeDist.get(free) ?? 0) + 1);
  }

  return {
    depth,
    prefixCount: prefixes.length,
    degreeDistribution: degDist,
    freeNeighborDistribution: freeDist,
  };
}

// ── Per-neighbor grouping ──

interface NeighborPrefixCounts {
  neighbor: number;
  countsByDepth: number[]; // index 0 = depth 1
}

function groupPrefixesByNeighbor(
  neighbors: number[],
  prefixesByDepth: Map<number, PathEntry[]>,
  maxDepth: number,
): NeighborPrefixCounts[] {
  return neighbors.map((nb) => {
    const countsByDepth: number[] = [];
    for (let d = 1; d <= maxDepth; d++) {
      const prefixes = prefixesByDepth.get(d) ?? [];
      countsByDepth.push(prefixes.filter((p) => p.tiles[0] === nb).length);
    }
    return { neighbor: nb, countsByDepth };
  });
}

export type { FanoutStats, NeighborPrefixCounts, TipStats };
export {
  buildFanoutMap,
  computeFanoutStats,
  computeTipStats,
  enumeratePrefixes,
  groupPrefixesByNeighbor,
  prefixKey,
};
