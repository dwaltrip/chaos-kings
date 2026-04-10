import { Board, type FlatBoard } from '@core-next/flat-board';

import { scoreStartingRegion, type TipScores } from '../starting-region/tip-scorer';
import { buildStartingRegion } from '../starting-region/build';

// Dumb prefix-set generator.
//
// A "prefix" is a non-backtracking path starting at the general, of some
// length L. Tiles are ordered [general, step1, step2, …, tip]. The last tile
// is the "tip" where the downstream lane begins.
//
// A "prefix-set" is K prefixes — one per burst in a profile — that together
// constitute the opening of a round. All prefixes share the general as their
// first tile.
//
// Overlap is defined as:
//   overlap = (sum of path lengths) - |union of tiles across the set|
//
// NOTE: The general is always shared by all K paths, which forces a minimum
// overlap of (K - 1) for any valid prefix-set. Callers should set
// maxOverlap >= K - 1 for any results; setting it to exactly K - 1 means
// "no sharing beyond the forced general".
//
// Generation algorithm: DFS enumerate all length-L paths from the general
// per burst (reusing the lane enum-paths helper shape), then enumerate
// ordered K-tuples with overlap filtering and early termination by the
// maxIterations cap. Scoring is aggregate over the tip scores of each prefix;
// default aggregate is 'sum'. Top-K results are returned.
//
// This is intentionally simple. It's not trying to be smart about the
// combinatorics — for prefix length L ≤ 6 and ≤3 bursts, the raw enumeration
// is cheap on the boards we care about. The point is to close the
// scorer → generator → harness loop end to end before investing in anything
// cleverer.

interface PrefixPath {
  // Ordered tiles, starting with the general and ending at the tip.
  tiles: number[];
  // Bitmask of tiles for fast overlap checks.
  mask: bigint;
  tip: number;
  // Score of the tip tile under the supplied scorer.
  tipScore: number;
}

interface PrefixSet {
  // K prefixes in burst order. All share tiles[0] = general.
  prefixes: PrefixPath[];
  // Union of tiles across the set.
  unionTiles: Set<number>;
  unionMask: bigint;
  // (sum path lengths) - |union|. Minimum value is K-1 (forced general share).
  overlap: number;
  // Aggregate of the tip scores under the configured aggregator.
  aggregateScore: number;
  // Copy of per-prefix tip scores, ordered by burst.
  tipScores: number[];
}

type ScoreAggregator = 'sum' | 'min' | 'max';

interface GenerateOptions {
  board: FlatBoard;
  general: number;
  // Length of each burst's prefix (tiles in the path including the general).
  // Pass a number[] of length K (one per burst). Must all be >= 2.
  prefixLengths: number[];
  // Maximum (sum lengths - |union|). Must be >= prefixLengths.length - 1 to
  // allow for the forced general sharing.
  maxOverlap: number;
  // Number of top-scoring prefix-sets to keep.
  topK: number;
  // Hard cap on combinations visited. Generation stops when exceeded;
  // partial results are returned with `capped: true`.
  maxIterations: number;
  // How to combine the per-prefix tip scores. Default 'sum'.
  aggregator?: ScoreAggregator;
  // Optional precomputed tip scores. If omitted, the starting region is
  // built from scratch and scored with default weights.
  tipScores?: TipScores;
}

interface GenerateResult {
  sets: PrefixSet[];
  iterations: number;
  capped: boolean;
  // Number of candidate paths per burst (before combining).
  pathCountsPerBurst: number[];
  tipScores: TipScores;
  elapsedMs: number;
}

// Enumerate all non-backtracking paths of exactly `length` tiles starting
// at `start` on walkable tiles. The starting tile is always included as the
// first tile of the path.
function enumeratePathsFromStart(
  board: FlatBoard,
  start: number,
  length: number,
): PrefixPath[] {
  if (length < 1) return [];
  if (!Board.isPassable(board, start)) return [];
  const results: PrefixPath[] = [];
  const path: number[] = new Array(length);
  path[0] = start;
  const startBit = 1n << BigInt(start);

  function dfs(depth: number, mask: bigint): void {
    if (depth === length) {
      const tiles = path.slice();
      results.push({
        tiles,
        mask,
        tip: tiles[tiles.length - 1],
        tipScore: 0, // filled in later once we know the scorer
      });
      return;
    }
    const current = path[depth - 1];
    const neighbors = [
      Board.neighborUp(board, current),
      Board.neighborDown(board, current),
      Board.neighborLeft(board, current),
      Board.neighborRight(board, current),
    ];
    for (const n of neighbors) {
      if (n < 0) continue;
      if (!Board.isPassable(board, n)) continue;
      const bit = 1n << BigInt(n);
      if (mask & bit) continue;
      path[depth] = n;
      dfs(depth + 1, mask | bit);
    }
  }

  dfs(1, startBit);
  return results;
}

function aggregate(scores: number[], mode: ScoreAggregator): number {
  if (scores.length === 0) return 0;
  if (mode === 'sum') return scores.reduce((a, b) => a + b, 0);
  if (mode === 'min') return Math.min(...scores);
  return Math.max(...scores);
}

// Insert a candidate into a bounded top-K heap, deduplicated by unionMask.
// Two prefix-sets with the same union produce identical downstream results
// (frontier, lane decomposition), so they're redundant. Keeps the top-K
// reflective of *distinct* blobs rather than filling up with burst-order
// permutations of the same union. O(topK) per insert — fine for topK ≤ ~100.
function insertTopK(
  heap: PrefixSet[],
  seenUnions: Map<string, number>,
  cand: PrefixSet,
  topK: number,
): void {
  const key = cand.unionMask.toString();
  const existingIdx = seenUnions.get(key);
  if (existingIdx != null) {
    // Already have a prefix-set with this union. Keep the one with the
    // higher aggregate score (and if equal, don't bother).
    if (cand.aggregateScore > heap[existingIdx].aggregateScore) {
      heap[existingIdx] = cand;
      // Bubble up to maintain sort.
      let i = existingIdx;
      while (i > 0 && heap[i - 1].aggregateScore < heap[i].aggregateScore) {
        [heap[i - 1], heap[i]] = [heap[i], heap[i - 1]];
        seenUnions.set(heap[i].unionMask.toString(), i);
        seenUnions.set(heap[i - 1].unionMask.toString(), i - 1);
        i--;
      }
    }
    return;
  }
  if (heap.length < topK) {
    heap.push(cand);
    let i = heap.length - 1;
    seenUnions.set(key, i);
    while (i > 0 && heap[i - 1].aggregateScore < heap[i].aggregateScore) {
      [heap[i - 1], heap[i]] = [heap[i], heap[i - 1]];
      seenUnions.set(heap[i].unionMask.toString(), i);
      seenUnions.set(heap[i - 1].unionMask.toString(), i - 1);
      i--;
    }
    return;
  }
  if (cand.aggregateScore <= heap[heap.length - 1].aggregateScore) return;
  const evicted = heap[heap.length - 1];
  seenUnions.delete(evicted.unionMask.toString());
  heap[heap.length - 1] = cand;
  let i = heap.length - 1;
  seenUnions.set(key, i);
  while (i > 0 && heap[i - 1].aggregateScore < heap[i].aggregateScore) {
    [heap[i - 1], heap[i]] = [heap[i], heap[i - 1]];
    seenUnions.set(heap[i].unionMask.toString(), i);
    seenUnions.set(heap[i - 1].unionMask.toString(), i - 1);
    i--;
  }
}

function generatePrefixSets(options: GenerateOptions): GenerateResult {
  const {
    board,
    general,
    prefixLengths,
    maxOverlap,
    topK,
    maxIterations,
    aggregator = 'sum',
  } = options;

  const K = prefixLengths.length;
  if (K === 0) {
    throw new Error('prefixLengths must be non-empty');
  }
  for (const L of prefixLengths) {
    if (L < 2) throw new Error(`prefix length must be >= 2, got ${L}`);
  }
  const minOverlap = K - 1;
  if (maxOverlap < minOverlap) {
    throw new Error(
      `maxOverlap=${maxOverlap} is below the forced minimum of ${minOverlap} ` +
        `(K=${K} prefixes all share the general)`,
    );
  }

  const t0 = Date.now();

  // Ensure we have tip scores. If not supplied, build the starting region
  // with defaults and score it.
  const tipScores =
    options.tipScores ?? scoreStartingRegion(buildStartingRegion(board, general));

  // Per-burst candidate path lists. Because multiple bursts may share the
  // same length, we can deduplicate enumeration by length.
  const uniqueLengths = new Set(prefixLengths);
  const pathsByLength = new Map<number, PrefixPath[]>();
  for (const L of uniqueLengths) {
    const paths = enumeratePathsFromStart(board, general, L);
    for (const p of paths) {
      p.tipScore = tipScores.scores.get(p.tip) ?? 0;
    }
    // Sort descending by tipScore — this gives the outer loop a good ordering
    // for early-top-K pruning (higher-score candidates visited first).
    paths.sort((a, b) => b.tipScore - a.tipScore);
    pathsByLength.set(L, paths);
  }

  const candidatesPerBurst: PrefixPath[][] = prefixLengths.map(
    (L) => pathsByLength.get(L)!,
  );
  const pathCountsPerBurst = candidatesPerBurst.map((c) => c.length);

  const heap: PrefixSet[] = [];
  const seenUnions = new Map<string, number>();
  let iterations = 0;
  let capped = false;

  const currentPrefixes: PrefixPath[] = new Array(K);
  const currentScores: number[] = new Array(K);

  function recurse(burstIdx: number, unionMask: bigint, unionSize: number): void {
    if (capped) return;
    if (burstIdx === K) {
      const sumLen = prefixLengths.reduce((a, b) => a + b, 0);
      const overlap = sumLen - unionSize;
      if (overlap > maxOverlap) return;
      // Rebuild union set for the result.
      const unionTiles = new Set<number>();
      for (let i = 0; i < K; i++) {
        for (const t of currentPrefixes[i].tiles) unionTiles.add(t);
      }
      const agg = aggregate(currentScores, aggregator);
      insertTopK(
        heap,
        seenUnions,
        {
          prefixes: currentPrefixes.slice(),
          unionTiles,
          unionMask,
          overlap,
          aggregateScore: agg,
          tipScores: currentScores.slice(),
        },
        topK,
      );
      return;
    }
    const candidates = candidatesPerBurst[burstIdx];
    for (const cand of candidates) {
      iterations++;
      if (iterations > maxIterations) {
        capped = true;
        return;
      }
      // Compute union delta — count tiles in cand.tiles not already in
      // unionMask. We walk the array rather than doing popcount because we
      // also need to check the cap early.
      let newTiles = 0;
      for (const t of cand.tiles) {
        const bit = 1n << BigInt(t);
        if (!(unionMask & bit)) newTiles++;
      }
      const newUnionSize = unionSize + newTiles;
      // Partial overlap lower bound: even if all remaining bursts add
      // zero new tiles, overlap = sum(prefixLengths) - newUnionSize. Prune
      // if already guaranteed to exceed maxOverlap.
      const remainingSum = prefixLengths.slice(burstIdx + 1).reduce((a, b) => a + b, 0);
      const bestPossibleUnion = newUnionSize + remainingSum;
      const sumLen = prefixLengths.reduce((a, b) => a + b, 0);
      const minAchievableOverlap = sumLen - bestPossibleUnion;
      if (minAchievableOverlap > maxOverlap) continue;

      currentPrefixes[burstIdx] = cand;
      currentScores[burstIdx] = cand.tipScore;
      recurse(burstIdx + 1, unionMask | cand.mask, newUnionSize);
      if (capped) return;
    }
  }

  recurse(0, 0n, 0);

  const elapsedMs = Date.now() - t0;
  return {
    sets: heap,
    iterations,
    capped,
    pathCountsPerBurst,
    tipScores,
    elapsedMs,
  };
}

export type { GenerateOptions, GenerateResult, PrefixPath, PrefixSet, ScoreAggregator };
export { enumeratePathsFromStart, generatePrefixSets };
