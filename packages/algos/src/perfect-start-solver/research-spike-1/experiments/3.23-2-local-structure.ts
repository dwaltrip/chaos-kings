// Thread 7: Local structure within burst range (d ≤ 12 from general).
// Classifies tiles near the general as pocket, corridor, or open.
//
// Pocket = gated region (far side of cut vertex) + cut vertex + corridor
//          opening (degree-2 chain from cut vertex toward general).
// Corridor = degree-2 tile NOT part of a pocket.
// Open = everything else.
//
// Usage: npx tsx src/perfect-start-solver/research-spike-1/experiments/3.23-2-local-structure.ts

import { Board, type FlatBoard, TileType } from '@/core-next/flat-board';
import { Direction } from '@core/types';
import { fromBoardState } from '@/core-next/convert';

import {
  decomposeRegions,
  findCorridors,
  getWalkableDegree,
  getWalkableNeighbors,
  getWalkableTiles,
  tarjan,
} from '../../utils/board-graph';
import { formatTable } from '../../format';
import { solveV3 } from '../../custom-algo-1/solver-v3';
import {
  simpleBoards,
  realisticBoards,
  slowSearch,
  type TestBoard,
} from '../../test-boards';

const DIRECTIONS = [Direction.LEFT, Direction.UP, Direction.RIGHT, Direction.DOWN];
const MAX_BURST = 12;

// ── BFS distance from general to all walkable tiles ──

function bfsDistances(board: FlatBoard, start: number): Map<number, number> {
  const dist = new Map<number, number>();
  dist.set(start, 0);
  let frontier = [start];
  let d = 0;
  while (frontier.length > 0) {
    d++;
    const next: number[] = [];
    for (const tile of frontier) {
      for (const dir of DIRECTIONS) {
        const nb = Board.neighbor(board, tile, dir);
        if (!Board.isValidIndex(board, nb)) continue;
        if (board.types[nb] === TileType.MOUNTAIN) continue;
        if (dist.has(nb)) continue;
        dist.set(nb, d);
        next.push(nb);
      }
    }
    frontier = next;
  }
  return dist;
}

// ── Pocket computation ──
// A pocket = gated region (far side of cut vertex) + the cut vertex itself
//          + corridor opening (degree-2 chain from cut vertex toward the general)

function buildPocketTiles(
  board: FlatBoard,
  generalPos: number,
  articulationPoints: Set<number>,
  regions: Array<{ tiles: Set<number>; adjacentCutVertices: Set<number> }>,
  dists: Map<number, number>,
): Set<number> {
  const pocketTiles = new Set<number>();

  // Find the general's region
  const generalRegion = regions.find((r) => {
    for (const dir of DIRECTIONS) {
      const nb = Board.neighbor(board, generalPos, dir);
      if (Board.isValidIndex(board, nb) && r.tiles.has(nb)) return true;
    }
    return false;
  });

  for (const ap of articulationPoints) {
    // Find gated regions (not the general's region, adjacent to this cut vertex)
    let hasGatedRegion = false;
    for (const region of regions) {
      if (region === generalRegion) continue;
      if (!region.adjacentCutVertices.has(ap)) continue;
      hasGatedRegion = true;
      for (const tile of region.tiles) {
        pocketTiles.add(tile);
      }
    }

    if (!hasGatedRegion) continue;

    // Add the cut vertex itself
    pocketTiles.add(ap);

    // Walk from cut vertex toward the general along degree-2 tiles
    let current = ap;
    while (true) {
      const neighbors = getWalkableNeighbors(board, current);
      let nextCorridor: number | null = null;
      for (const nb of neighbors) {
        if (pocketTiles.has(nb)) continue;
        const nbDist = dists.get(nb);
        const curDist = dists.get(current);
        if (nbDist === undefined || curDist === undefined) continue;
        if (nbDist >= curDist) continue;
        if (getWalkableDegree(board, nb) === 2) {
          nextCorridor = nb;
        }
      }
      if (nextCorridor === null) break;
      pocketTiles.add(nextCorridor);
      current = nextCorridor;
    }
  }

  return pocketTiles;
}

// ── Analysis ──

interface BoardAnalysis {
  name: string;
  genDeg: number;
  solveMs: number;
  captures: number;
  inRange: {
    total: number;
    pocket: number;
    corridor: number;
    open: number;
  };
  perDist: Array<{
    d: number;
    total: number;
    pocket: number;
    corridor: number;
    open: number;
  }>;
}

function analyzeBoard(tb: TestBoard): BoardAnalysis {
  const board = fromBoardState(tb.board, 1);
  const generalPos = Board.toIndex(board, tb.generalCoord.x, tb.generalCoord.y);

  const genDeg = getWalkableDegree(board, generalPos);
  const corridors = findCorridors(board);
  const { articulationPoints } = tarjan(board);
  const { regions } = decomposeRegions(board, articulationPoints);

  const result = solveV3(board, generalPos);
  const solveMs = result.elapsedMs;
  const captures = result.solution?.totalCaptured ?? 0;

  const dists = bfsDistances(board, generalPos);
  const pocketTiles = buildPocketTiles(
    board,
    generalPos,
    articulationPoints,
    regions,
    dists,
  );

  const perDist: BoardAnalysis['perDist'] = [];
  const inRange = { total: 0, pocket: 0, corridor: 0, open: 0 };

  for (let d = 1; d <= MAX_BURST; d++) {
    const shell = { d, total: 0, pocket: 0, corridor: 0, open: 0 };

    for (const [tile, tileDist] of dists) {
      if (tile === generalPos) continue;
      if (tileDist !== d) continue;

      shell.total++;
      if (pocketTiles.has(tile)) {
        shell.pocket++;
      } else if (corridors.corridorTiles.has(tile)) {
        shell.corridor++;
      } else {
        shell.open++;
      }
    }

    inRange.total += shell.total;
    inRange.pocket += shell.pocket;
    inRange.corridor += shell.corridor;
    inRange.open += shell.open;
    perDist.push(shell);
  }

  return { name: tb.name, genDeg, solveMs, captures, inRange, perDist };
}

// ── Formatting ──

function fmtMs(ms: number): string {
  return ms < 10 ? ms.toFixed(1) : String(Math.round(ms));
}

function fmtPct(n: number, total: number): string {
  if (total === 0) return '0%';
  return Math.round((n / total) * 100) + '%';
}

function printSummaryTable(title: string, analyses: BoardAnalysis[]): void {
  const sorted = [...analyses].sort((a, b) => a.solveMs - b.solveMs);

  const headers = [
    'Board',
    'Deg',
    'Ms',
    'Cap',
    'InRange',
    'Pocket',
    'Corr',
    'Open',
    '%Pocket',
    '%Constrained',
  ];

  const rows = sorted.map((r) => [
    r.name,
    String(r.genDeg),
    fmtMs(r.solveMs),
    String(r.captures),
    String(r.inRange.total),
    String(r.inRange.pocket),
    String(r.inRange.corridor),
    String(r.inRange.open),
    fmtPct(r.inRange.pocket, r.inRange.total),
    fmtPct(r.inRange.pocket + r.inRange.corridor, r.inRange.total),
  ]);

  console.log(`\n## ${title}\n`);
  console.log(formatTable(headers, rows));
}

function printPerDistBreakdown(analyses: BoardAnalysis[]): void {
  const slowNames = new Set(slowSearch().map((b) => b.name));
  const slow = analyses
    .filter((a) => slowNames.has(a.name))
    .sort((a, b) => a.solveMs - b.solveMs);

  if (slow.length === 0) return;

  console.log('\n## Per-distance breakdown (slow boards)\n');

  for (const a of slow) {
    console.log(
      `**${a.name}**  (${fmtMs(a.solveMs)}ms, deg=${a.genDeg}, cap=${a.captures})`,
    );

    const headers = ['d', 'Total', 'Pocket', 'Corr', 'Open'];
    const rows = a.perDist.map((s) => [
      String(s.d),
      String(s.total),
      String(s.pocket),
      String(s.corridor),
      String(s.open),
    ]);

    console.log(formatTable(headers, rows));
    console.log();
  }
}

// ── Run ──

const simpleResults = simpleBoards().map(analyzeBoard);
const realisticResults = realisticBoards().map(analyzeBoard);

printSummaryTable('Local structure within burst range — Simple boards', simpleResults);
printSummaryTable(
  'Local structure within burst range — Realistic boards',
  realisticResults,
);

printPerDistBreakdown([...simpleResults, ...realisticResults]);
