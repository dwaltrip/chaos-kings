// Prefix enumeration experiment (sections 1-4).
// Enumerates all non-backtracking path prefixes from the general at depths 1-4.
// Measures: prefix pool sizes, per-neighbor breakdown, fan-out to full-length
// paths, and tip properties (degree, free neighbors).
//
// Usage: npx tsx src/perfect-start-solver/research-spike-1/experiments/3.23-3-prefix-enumeration.ts

import { Board, type FlatBoard } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import type { PathEntriesByLen, PathEntry } from '../../custom-algo-1/path-search';
import { getWalkableNeighbors } from '../../utils/board-graph';
import { formatTable } from '../../format';
import { makeBoard, type TestBoard } from '../../test-boards';
import {
  buildFanoutMap,
  computeFanoutStats,
  computeTipStats,
  enumeratePrefixes,
  groupPrefixesByNeighbor,
  type FanoutStats,
  type NeighborPrefixCounts,
  type TipStats,
} from '../prefix-utils';

// ── Config ──

const BOARD_NAMES = [
  // Fast simple
  'open-7x7',
  'sparse-mtns-9x9',
  // Fast realistic
  '3.21-real-board-medium-spacious',
  '3.22-fairly-open',
  // Slow simple
  'corner-9x9',
  'pocket-11x11',
  'pocket-2-11x11',
  'corner-13x13',
  // Slow realistic
  '3.21-real-board-tight-corner-1',
  '3.21-real-board-tight-corner-2',
];

const MAX_PREFIX_DEPTH = 4;
const FANOUT_TARGETS = [8, 10, 12];
const MAX_PATH_LEN = 12;

// ── Analysis ──

interface BoardResult {
  name: string;
  board: FlatBoard;
  generalPos: number;
  genDeg: number;
  entriesByLen: PathEntriesByLen;
  neighbors: number[];
  prefixesByDepth: Map<number, PathEntry[]>;
  neighborCounts: NeighborPrefixCounts[];
  fanout: FanoutStats[];
  tips: TipStats[];
}

function analyzeBoard(tb: TestBoard): BoardResult {
  const board = fromBoardState(tb.board, 1);
  const generalPos = Board.toIndex(board, tb.generalCoord.x, tb.generalCoord.y);
  const neighbors = getWalkableNeighbors(board, generalPos);

  const { entriesByLen, prefixesByDepth } = enumeratePrefixes(
    board,
    generalPos,
    MAX_PREFIX_DEPTH,
    MAX_PATH_LEN,
  );

  // Per-neighbor counts
  const neighborCounts = groupPrefixesByNeighbor(
    neighbors,
    prefixesByDepth,
    MAX_PREFIX_DEPTH,
  );

  // Fan-out stats
  const fanout: FanoutStats[] = [];
  for (let d = 1; d <= MAX_PREFIX_DEPTH; d++) {
    const prefixes = prefixesByDepth.get(d) ?? [];
    if (prefixes.length === 0) continue;

    for (const tgt of FANOUT_TARGETS) {
      if (tgt <= d) continue;
      const totalPaths = entriesByLen.get(tgt)?.length ?? 0;
      const fmap = buildFanoutMap(entriesByLen, d, tgt);
      fanout.push(computeFanoutStats(prefixes, fmap, d, tgt, totalPaths));
    }
  }

  // Tip stats
  const tips: TipStats[] = [];
  for (let d = 1; d <= MAX_PREFIX_DEPTH; d++) {
    const prefixes = prefixesByDepth.get(d) ?? [];
    if (prefixes.length === 0) continue;
    tips.push(computeTipStats(board, generalPos, prefixes, d));
  }

  return {
    name: tb.name,
    board,
    generalPos,
    genDeg: neighbors.length,
    entriesByLen,
    neighbors,
    prefixesByDepth,
    neighborCounts,
    fanout,
    tips,
  };
}

// ── Formatting helpers ──

function tileXY(board: FlatBoard, tile: number): string {
  const x = tile % board.width;
  const y = Math.floor(tile / board.width);
  return `(${x},${y})`;
}

// ── Section 1: Prefix pool sizes ──

function printPrefixPoolSizes(results: BoardResult[]): void {
  console.log('# Prefix Enumeration Results\n');
  console.log('## 1. Prefix pool sizes\n');
  console.log('Count of non-backtracking paths from general at each depth.\n');

  // Also show total path counts at target lengths for context.
  const headers = ['Board', 'Deg', 'd=1', 'd=2', 'd=3', 'd=4', 'len8', 'len10', 'len12'];
  const rows = results.map((r) => [
    r.name,
    String(r.genDeg),
    ...[1, 2, 3, 4].map((d) => String(r.prefixesByDepth.get(d)?.length ?? 0)),
    ...FANOUT_TARGETS.map((t) => String(r.entriesByLen.get(t)?.length ?? 0)),
  ]);

  console.log(formatTable(headers, rows));
}

// ── Section 2: Per-neighbor counts ──

function printPerNeighborCounts(results: BoardResult[]): void {
  console.log('\n## 2. Per-neighbor prefix counts\n');

  for (const r of results) {
    console.log(
      `**${r.name}** (deg=${r.genDeg}, general=${tileXY(r.board, r.generalPos)})`,
    );

    const headers = ['Neighbor', 'd=1', 'd=2', 'd=3', 'd=4'];
    const rows = r.neighborCounts.map((nc) => [
      tileXY(r.board, nc.neighbor),
      ...nc.countsByDepth.map(String),
    ]);

    console.log(formatTable(headers, rows));
    console.log();
  }
}

// ── Section 3: Fan-out ──

function printFanout(results: BoardResult[]): void {
  console.log('## 3. Fan-out: prefix → full-length paths\n');
  console.log(
    'For each prefix at depth D, how many paths of target length share that prefix.',
  );
  console.log('Mean × #Pfx = TotalPaths (every long path has exactly one prefix).\n');

  for (const r of results) {
    console.log(`**${r.name}**`);

    const headers = [
      'Depth',
      'TgtLen',
      '#Pfx',
      'TotPaths',
      'Min',
      'Med',
      'Max',
      'Mean',
      'Dead',
    ];
    const rows = r.fanout.map((f) => [
      String(f.depth),
      String(f.targetLen),
      String(f.prefixCount),
      String(f.totalPaths),
      String(f.min),
      String(f.median),
      String(f.max),
      f.mean.toFixed(1),
      String(f.dead),
    ]);

    console.log(formatTable(headers, rows));
    console.log();
  }
}

// ── Section 4: Tip properties ──

function printTipProperties(results: BoardResult[]): void {
  console.log('## 4. Tip properties\n');
  console.log('Walkable degree and free (non-path) neighbors of the prefix tip.\n');

  for (const r of results) {
    console.log(`**${r.name}**`);

    const headers = [
      'Depth',
      '#Pfx',
      'deg1',
      'deg2',
      'deg3',
      'deg4',
      'free0',
      'free1',
      'free2',
      'free3',
    ];
    const rows = r.tips.map((t) => [
      String(t.depth),
      String(t.prefixCount),
      ...[1, 2, 3, 4].map((k) => String(t.degreeDistribution.get(k) ?? 0)),
      ...[0, 1, 2, 3].map((k) => String(t.freeNeighborDistribution.get(k) ?? 0)),
    ]);

    console.log(formatTable(headers, rows));
    console.log();
  }
}

// ── Main ──

const boards = BOARD_NAMES.map((name) => makeBoard(name));

console.error('Running prefix enumeration experiment...');
const results: BoardResult[] = [];
for (const tb of boards) {
  console.error(`  ${tb.name}...`);
  results.push(analyzeBoard(tb));
}
console.error('');

printPrefixPoolSizes(results);
printPerNeighborCounts(results);
printFanout(results);
printTipProperties(results);
