// Routing score experiment on the 6x6 pocket board from the scratchpad.
//
// For each candidate burst-1 path, compute:
//   1. Per-tile fresh-neighbor counts in the residual (within distance D)
//   2. Aggregate routing score = sum of fresh-neighbor counts = 2 × fresh-fresh edges
//   3. Per-direction breakdown (by which neighbor of the general the tile is "closest to")
//
// Goal: see if the routing score separates burst groups B > A > C
// as the dominance intuition predicts.

import { Board, type FlatBoard } from '@core-next/flat-board';
import { fromBoardState } from '@core-next/convert';

import { parseFlatBaord } from '../utils/parse-board';
import { getWalkableNeighbors, getWalkableDegree } from '../utils/board-graph';
import { bfsDistanceField } from '../utils/bfs-distance-field';
import { renderBoard } from '../utils/render-board';

// ── Board setup ──

const BOARD_TEXT = `
· · · · · ·
· · · · · ·
· · · · # #
· · · · · G
· · · · · ·
· · · · · ·
`;

const { board, general } = parseFlatBaord(BOARD_TEXT);
const W = board.width;

function idx(x: number, y: number): number {
  return Board.toIndex(board, x, y);
}

function xyStr(tile: number): string {
  const { x, y } = Board.toXY(board, tile);
  return `(${x},${y})`;
}

// ── Burst definitions ──
// Each burst is a list of tiles captured (NOT including the general).
// Order = path order from general outward.

const BURSTS_LEN_6: Record<string, number[]> = {
  'A-1': [idx(4, 3), idx(3, 3), idx(2, 3), idx(2, 4), idx(2, 5), idx(3, 5)],
  'A-2': [idx(4, 3), idx(3, 3), idx(2, 3), idx(1, 3), idx(0, 3), idx(0, 2)],

  'B-1': [idx(4, 3), idx(3, 3), idx(3, 2), idx(3, 1), idx(4, 1), idx(5, 1)],
  'B-2': [idx(4, 3), idx(3, 3), idx(3, 2), idx(3, 1), idx(3, 0), idx(2, 0)],

  'C-1': [idx(4, 3), idx(3, 3), idx(2, 3), idx(2, 4), idx(3, 4), idx(4, 4)],
  'C-2': [idx(5, 4), idx(5, 5), idx(4, 5), idx(4, 4), idx(3, 4), idx(3, 3)],
};

const BURSTS_LEN_7: Record<string, number[]> = {
  'A-1': [idx(4, 3), idx(3, 3), idx(2, 3), idx(2, 4), idx(2, 5), idx(3, 5), idx(4, 5)],
  'A-2': [idx(4, 3), idx(3, 3), idx(2, 3), idx(1, 3), idx(0, 3), idx(0, 2), idx(0, 1)],

  'B-1': [idx(4, 3), idx(3, 3), idx(3, 2), idx(3, 1), idx(4, 1), idx(5, 1), idx(5, 0)],
  'B-2': [idx(4, 3), idx(3, 3), idx(3, 2), idx(3, 1), idx(3, 0), idx(2, 0), idx(1, 0)],

  'C-1': [idx(4, 3), idx(3, 3), idx(2, 3), idx(2, 4), idx(3, 4), idx(4, 4), idx(4, 5)],
  'C-2': [idx(5, 4), idx(5, 5), idx(4, 5), idx(4, 4), idx(4, 3), idx(3, 3), idx(2, 3)],
};

const BURSTS = BURSTS_LEN_7;

// ── Validate burst paths ──

function validateBurst(name: string, tiles: number[]): void {
  // Check: each tile is walkable, non-general, non-mountain
  for (const t of tiles) {
    if (t === general) throw new Error(`${name}: burst includes general`);
    if (board.types[t] === 1) throw new Error(`${name}: tile ${xyStr(t)} is mountain`);
  }
  // Check: first tile is adjacent to general
  const genNeighbors = getWalkableNeighbors(board, general);
  if (!genNeighbors.includes(tiles[0])) {
    throw new Error(`${name}: first tile ${xyStr(tiles[0])} not adjacent to general`);
  }
  // Check: each consecutive pair is adjacent
  for (let i = 1; i < tiles.length; i++) {
    const neighbors = getWalkableNeighbors(board, tiles[i - 1]);
    if (!neighbors.includes(tiles[i])) {
      throw new Error(
        `${name}: tile ${xyStr(tiles[i])} not adjacent to ${xyStr(tiles[i - 1])}`,
      );
    }
  }
  // Check: no duplicates
  if (new Set(tiles).size !== tiles.length) {
    throw new Error(`${name}: duplicate tiles`);
  }
}

for (const [name, tiles] of Object.entries(BURSTS)) {
  validateBurst(name, tiles);
}

// ── BFS distance field from general ──

const distField = bfsDistanceField(board, general);

// ── Directional assignment ──
// Assign each tile to a "direction" based on which neighbor of the general
// it's closest to (BFS on the subgraph excluding the general).
// Tiles equidistant get assigned to the first neighbor found (arbitrary but stable).

function computeDirectionAssignment(): Map<number, number> {
  const genNeighbors = getWalkableNeighbors(board, general);
  const assignment = new Map<number, number>();

  // BFS from each neighbor, excluding the general tile
  for (const neighbor of genNeighbors) {
    const queue = [neighbor];
    const visited = new Set<number>([neighbor, general]);

    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      if (!assignment.has(cur)) {
        assignment.set(cur, neighbor);
      }
      for (const next of getWalkableNeighbors(board, cur)) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return assignment;
}

const directionOf = computeDirectionAssignment();

// ── Routing score computation ──

interface RoutingScore {
  burstName: string;
  totalFreshEdges: number; // sum of fresh-neighbor-counts (= 2 × fresh-fresh edges)
  totalFreshTiles: number;
  avgFreshNeighbors: number;

  // Per-direction breakdown
  perDirection: Map<number, { freshTiles: number; freshEdges: number }>;

  // Per-distance breakdown
  perDistance: Map<number, { freshTiles: number; freshEdges: number }>;
}

function computeRoutingScore(
  burstName: string,
  capturedTiles: number[],
  maxDist: number,
): RoutingScore {
  const captured = new Set(capturedTiles);

  // A tile is "fresh" if it's walkable, not the general, not captured
  function isFresh(t: number): boolean {
    return (
      t !== general &&
      !captured.has(t) &&
      board.types[t] !== 1 && // not mountain
      (distField.distance.get(t) ?? Infinity) <= maxDist
    );
  }

  function freshNeighborCount(t: number): number {
    let count = 0;
    for (const n of getWalkableNeighbors(board, t)) {
      if (isFresh(n)) count++;
    }
    return count;
  }

  let totalFreshEdges = 0;
  let totalFreshTiles = 0;

  const perDirection = new Map<number, { freshTiles: number; freshEdges: number }>();
  const perDistance = new Map<number, { freshTiles: number; freshEdges: number }>();

  // Initialize direction buckets
  const genNeighbors = getWalkableNeighbors(board, general);
  for (const n of genNeighbors) {
    perDirection.set(n, { freshTiles: 0, freshEdges: 0 });
  }

  for (const [tile, dist] of distField.distance) {
    if (!isFresh(tile)) continue;

    const fnc = freshNeighborCount(tile);
    totalFreshEdges += fnc;
    totalFreshTiles++;

    // Per-direction
    const dir = directionOf.get(tile);
    if (dir != null) {
      const bucket = perDirection.get(dir);
      if (bucket) {
        bucket.freshTiles++;
        bucket.freshEdges += fnc;
      }
    }

    // Per-distance
    if (!perDistance.has(dist)) {
      perDistance.set(dist, { freshTiles: 0, freshEdges: 0 });
    }
    const distBucket = perDistance.get(dist)!;
    distBucket.freshTiles++;
    distBucket.freshEdges += fnc;
  }

  return {
    burstName,
    totalFreshEdges,
    totalFreshTiles,
    avgFreshNeighbors: totalFreshTiles > 0 ? totalFreshEdges / totalFreshTiles : 0,
    perDirection,
    perDistance,
  };
}

// ── Also compute: fresh-only BFS reachability from each general neighbor ──
// (how many fresh tiles reachable WITHOUT traversing any captured tile)

function freshOnlyReach(capturedTiles: number[], maxDist: number): Map<number, number> {
  const captured = new Set(capturedTiles);
  const genNeighbors = getWalkableNeighbors(board, general);
  const result = new Map<number, number>();

  for (const startNeighbor of genNeighbors) {
    if (captured.has(startNeighbor)) {
      result.set(startNeighbor, 0);
      continue;
    }

    // BFS from startNeighbor, only stepping on fresh tiles
    const visited = new Set<number>([startNeighbor, general]);
    const queue = [startNeighbor];
    let head = 0;
    let reachCount = 0;

    while (head < queue.length) {
      const cur = queue[head++];
      const d = distField.distance.get(cur) ?? Infinity;
      if (d > maxDist) continue;
      reachCount++;

      for (const next of getWalkableNeighbors(board, cur)) {
        if (visited.has(next)) continue;
        if (captured.has(next)) continue;
        if (board.types[next] === 1) continue;
        visited.add(next);
        queue.push(next);
      }
    }

    result.set(startNeighbor, reachCount);
  }

  return result;
}

// ── Output ──

// What max distance to analyze? On a real board with 50 ticks, the longest
// remaining burst after burst-1 is ~7-8 captures + ~4 overlap = ~12 moves.
// On this tiny 6x6 board, everything is within dist 9. Use a lower D.
const MAX_DIST = 8;

console.log('=== 6x6 Pocket Board — Routing Score Experiment ===\n');

// Show the board
console.log('Board:');
console.log(
  renderBoard(board, {
    tileChar: (i) => (i === general ? 'G' : null),
  }),
);
console.log();

const { x: gx, y: gy } = Board.toXY(board, general);
console.log(`General: (${gx},${gy}) idx=${general}`);
const genNeighbors = getWalkableNeighbors(board, general);
console.log(`General neighbors: ${genNeighbors.map((n) => xyStr(n)).join(', ')}`);
console.log(`Max analysis distance: ${MAX_DIST}`);

// Baseline: no burst placed
const baseline = computeRoutingScore('(none)', [], MAX_DIST);
console.log(
  `\nBaseline (no burst): ${baseline.totalFreshEdges} routing edges, ${baseline.totalFreshTiles} fresh tiles`,
);
console.log();

// Score each burst
console.log('─'.repeat(70));
console.log('BURST SCORES (sorted best → worst by routing edges)');
console.log('─'.repeat(70));

const scores: Array<RoutingScore & { freshReach: Map<number, number> }> = [];

for (const [name, tiles] of Object.entries(BURSTS)) {
  const score = computeRoutingScore(name, tiles, MAX_DIST);
  const reach = freshOnlyReach(tiles, MAX_DIST);
  scores.push({ ...score, freshReach: reach });
}

// Sort by total routing edges descending (higher = better)
scores.sort((a, b) => b.totalFreshEdges - a.totalFreshEdges);

for (const score of scores) {
  const group = score.burstName[0];
  console.log(`\n${score.burstName} (group ${group}):`);
  console.log(
    `  Routing edges: ${score.totalFreshEdges}  ` +
      `(${baseline.totalFreshEdges - score.totalFreshEdges} fewer than baseline)`,
  );
  console.log(
    `  Fresh tiles: ${score.totalFreshTiles}  ` +
      `Avg fresh neighbors: ${score.avgFreshNeighbors.toFixed(2)}`,
  );

  // Show the burst on the board
  const capturedSet = new Set(BURSTS[score.burstName]);
  console.log(
    '  Board: ' +
      renderBoard(board, {
        tileChar: (i) => {
          if (i === general) return 'G';
          if (capturedSet.has(i)) return 'o';
          return null;
        },
      })
        .split('\n')
        .join('\n         '),
  );

  // Per-direction
  console.log('  Per direction:');
  for (const [dir, data] of score.perDirection) {
    const reachable = score.freshReach.get(dir) ?? 0;
    console.log(
      `    ${xyStr(dir).padEnd(6)}: ${data.freshTiles} tiles, ` +
        `${data.freshEdges} edges, ` +
        `fresh-only-reach=${reachable}`,
    );
  }

  // Per-distance (compact)
  const distEntries = [...score.perDistance.entries()].sort((a, b) => a[0] - b[0]);
  console.log(
    '  Per distance: ' +
      distEntries
        .map(([d, data]) => `d${d}:${data.freshTiles}t/${data.freshEdges}e`)
        .join('  '),
  );
}

// ── Cumulative routing scores by distance cutoff ──

console.log('\n' + '─'.repeat(70));
console.log('CUMULATIVE ROUTING SCORES BY DISTANCE CUTOFF');
console.log('─'.repeat(70));

const CUTOFFS = [2, 3, 4, 5, 6, 7, 8];

// Compute cumulative scores at each cutoff for each burst + baseline
type CumulativeRow = {
  burstName: string;
  group: string;
  cutoffScores: Map<number, { edges: number; tiles: number }>;
};

const cumulativeData: CumulativeRow[] = [];

// Baseline first
const baselineCumul: CumulativeRow = {
  burstName: '(none)',
  group: '-',
  cutoffScores: new Map(),
};
for (const D of CUTOFFS) {
  const s = computeRoutingScore('(none)', [], D);
  baselineCumul.cutoffScores.set(D, {
    edges: s.totalFreshEdges,
    tiles: s.totalFreshTiles,
  });
}
cumulativeData.push(baselineCumul);

// Each burst
for (const [name, tiles] of Object.entries(BURSTS)) {
  const row: CumulativeRow = {
    burstName: name,
    group: name[0],
    cutoffScores: new Map(),
  };
  for (const D of CUTOFFS) {
    const s = computeRoutingScore(name, tiles, D);
    row.cutoffScores.set(D, { edges: s.totalFreshEdges, tiles: s.totalFreshTiles });
  }
  cumulativeData.push(row);
}

// Print routing edges table
console.log('\nRouting edges (fresh-neighbor sum) within distance D:');
const header =
  'Burst   │ Group │ ' + CUTOFFS.map((d) => `D≤${d}`.padStart(5)).join(' │ ');
console.log(header);
console.log('────────┼───────┼' + CUTOFFS.map(() => '──────').join('┼'));

for (const row of cumulativeData) {
  const vals = CUTOFFS.map((d) => {
    const s = row.cutoffScores.get(d)!;
    return String(s.edges).padStart(5);
  });
  console.log(
    `${row.burstName.padEnd(7)} │ ${row.group.padEnd(5)} │ ${vals.join(' │ ')}`,
  );
}

// Print delta from baseline
console.log('\nΔ routing edges vs baseline (negative = fewer edges = worse):');
console.log(header);
console.log('────────┼───────┼' + CUTOFFS.map(() => '──────').join('┼'));

for (const row of cumulativeData) {
  if (row.burstName === '(none)') continue;
  const vals = CUTOFFS.map((d) => {
    const burst = row.cutoffScores.get(d)!;
    const base = baselineCumul.cutoffScores.get(d)!;
    const delta = burst.edges - base.edges;
    return String(delta).padStart(5);
  });
  console.log(
    `${row.burstName.padEnd(7)} │ ${row.group.padEnd(5)} │ ${vals.join(' │ ')}`,
  );
}

// ── Fresh-only reachability by distance cutoff ──

console.log('\nFresh-only reachability (0-overlap reach) within distance D:');
console.log(header);
console.log('────────┼───────┼' + CUTOFFS.map(() => '──────').join('┼'));

for (const [name, tiles] of Object.entries(BURSTS)) {
  const vals = CUTOFFS.map((d) => {
    const reach = freshOnlyReach(tiles, d);
    const total = [...reach.values()].reduce((a, b) => a + b, 0);
    return String(total).padStart(5);
  });
  console.log(`${name.padEnd(7)} │ ${name[0].padEnd(5)} │ ${vals.join(' │ ')}`);
}
