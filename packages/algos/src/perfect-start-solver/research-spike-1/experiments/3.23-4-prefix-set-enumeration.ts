// Prefix set enumeration experiment.
// For each board × prefix depth × (N, overlap pattern), enumerates all
// compatible prefix sets via sequential backtracking.
//
// Overlap patterns are pre-computed from the timing table (cap 20-24),
// deduplicated across capture targets.
//
// Usage:
//   npx tsx .../3.23-4-prefix-set-enumeration.ts                # both D=3 and D=4
//   npx tsx .../3.23-4-prefix-set-enumeration.ts --depth 4      # D=4 only
//   npx tsx .../3.23-4-prefix-set-enumeration.ts corner-13x13   # single board
//
// Detailed JSON output → experiments/output/3.23-4-prefix-set-enum-D{depth}.json
// Summary table → stdout

import * as fs from 'fs';
import * as path from 'path';

import { Board } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { buildTimingEntries } from '../../custom-algo-1/timing-table';
import type { TimingTableConfig } from '../../custom-algo-1/timing-table';
import { formatTable } from '../../format';
import { makeBoard, type TestBoard } from '../../test-boards';
import { enumeratePrefixes, enumeratePrefixSets } from '../prefix-utils';

// ── Config ──

const TIMING_CONFIG: TimingTableConfig = {
  maxTicks: 50,
  maxBurst: 12,
  maxBursts: 6,
  maxOverlapPerBurst: 3,
};

const CAP_RANGE = { min: 20, max: 24 };
const MAX_PATH_LEN = 12;
const MAX_SETS_PER_PATTERN = 10_000;

const DEFAULT_BOARDS = [
  // Simple (slow)
  'corner-13x13',
  'pocket-11x11',
  'scattered-pockets-13x13',
  // Realistic (slow)
  '3.21-real-board-tight-corner-1',
  '3.21-real-board-tight-corner-2',
  '3-22.tight-edge-with-chokes',
  // Realistic (faster, for contrast)
  '3.22-semi-open-with-small-pocket',
  '3.22-fairly-open',
];

// ── CLI parsing ──

function parseCLI(args: string[]): { depths: number[]; boardNames: string[] } {
  const depths: number[] = [];
  const boardNames: string[] = [];
  let i = 0;
  while (i < args.length) {
    if (args[i] === '--depth') {
      depths.push(Number(args[++i]));
    } else {
      boardNames.push(args[i]);
    }
    i++;
  }
  return {
    depths: depths.length > 0 ? depths : [3, 4],
    boardNames: boardNames.length > 0 ? boardNames : DEFAULT_BOARDS,
  };
}

// ── Overlap pattern pre-computation ──

// Extract unique overlap patterns from the timing table, grouped by N.
function getUniqueOverlapPatterns(
  capMin: number,
  capMax: number,
  config: TimingTableConfig,
): Map<number, number[][]> {
  const seen = new Set<string>();
  const byN = new Map<number, number[][]>();

  for (let cap = capMin; cap <= capMax; cap++) {
    const entries = buildTimingEntries(cap, config);
    for (const entry of entries) {
      const key = entry.overlaps.join(',');
      if (seen.has(key)) continue;
      seen.add(key);

      const N = entry.overlaps.length;
      if (!byN.has(N)) byN.set(N, []);
      byN.get(N)!.push(entry.overlaps);
    }
  }

  // Sort patterns within each N for stable output
  for (const [, patterns] of byN) {
    patterns.sort((a, b) => {
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return a[i] - b[i];
      }
      return 0;
    });
  }

  return byN;
}

// ── Per-board analysis ──

interface PatternResult {
  overlaps: number[];
  count: number;
  capped: boolean;
}

interface BoardDepthResult {
  board: string;
  depth: number;
  prefixPoolSize: number;
  byN: Map<number, PatternResult[]>;
}

function analyzeBoard(
  tb: TestBoard,
  D: number,
  patternsByN: Map<number, number[][]>,
): BoardDepthResult {
  const board = fromBoardState(tb.board, 1);
  const generalPos = Board.toIndex(board, tb.generalCoord.x, tb.generalCoord.y);

  const { prefixesByDepth } = enumeratePrefixes(board, generalPos, D, MAX_PATH_LEN);
  const prefixPoolSize = prefixesByDepth.get(D)?.length ?? 0;

  const byN = new Map<number, PatternResult[]>();

  for (const [N, patterns] of patternsByN) {
    const results: PatternResult[] = [];

    for (const overlaps of patterns) {
      const { count, capped } = enumeratePrefixSets(
        prefixesByDepth,
        overlaps,
        D,
        MAX_SETS_PER_PATTERN,
        // true,
        false,
      );
      results.push({ overlaps, count, capped });
    }

    byN.set(N, results);
  }

  return { board: tb.name, depth: D, prefixPoolSize, byN };
}

// ── Output formatting ──

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function printSummary(results: BoardDepthResult[]): void {
  for (const r of results) {
    console.log(`\n## ${r.board} (D=${r.depth}, pool=${r.prefixPoolSize})\n`);

    const headers = ['N', 'Patterns', '>0', 'TotalSets', 'Min', 'Med', 'Max', 'Capped'];
    const rows: string[][] = [];

    const sortedNs = [...r.byN.keys()].sort((a, b) => a - b);
    for (const N of sortedNs) {
      const patternResults = r.byN.get(N)!;
      const nonZero = patternResults.filter((p) => p.count > 0);
      const counts = nonZero.map((p) => p.count);
      const totalSets = counts.reduce((s, c) => s + c, 0);
      const cappedCount = nonZero.filter((p) => p.capped).length;

      rows.push([
        String(N),
        String(patternResults.length),
        String(nonZero.length),
        String(totalSets),
        counts.length > 0 ? String(Math.min(...counts)) : '-',
        counts.length > 0 ? String(median(counts)) : '-',
        counts.length > 0 ? String(Math.max(...counts)) : '-',
        cappedCount > 0 ? String(cappedCount) : '-',
      ]);
    }

    console.log(formatTable(headers, rows));
  }
}

interface DetailedJSON {
  board: string;
  depth: number;
  prefixPoolSize: number;
  byN: {
    N: number;
    patternsTotal: number;
    patternsWithSets: number;
    patterns: {
      overlaps: number[];
      count: number;
      capped: boolean;
    }[];
  }[];
}

function buildDetailedJSON(r: BoardDepthResult): DetailedJSON {
  const byN: DetailedJSON['byN'] = [];

  const sortedNs = [...r.byN.keys()].sort((a, b) => a - b);
  for (const N of sortedNs) {
    const patternResults = r.byN.get(N)!;
    // Only include patterns with count > 0 in detailed output
    const nonZero = patternResults.filter((p) => p.count > 0);

    byN.push({
      N,
      patternsTotal: patternResults.length,
      patternsWithSets: nonZero.length,
      patterns: nonZero.map((p) => ({
        overlaps: p.overlaps,
        count: p.count,
        capped: p.capped,
      })),
    });
  }

  return {
    board: r.board,
    depth: r.depth,
    prefixPoolSize: r.prefixPoolSize,
    byN,
  };
}

// ── Main ──

const { depths, boardNames } = parseCLI(process.argv.slice(2));
const boards = boardNames.map((name) => makeBoard(name));

// Pre-compute overlap patterns
console.error('Pre-computing overlap patterns from timing table...');
const patternsByN = getUniqueOverlapPatterns(CAP_RANGE.min, CAP_RANGE.max, TIMING_CONFIG);
for (const [N, patterns] of [...patternsByN.entries()].sort((a, b) => a[0] - b[0])) {
  console.error(`  N=${N}: ${patterns.length} unique patterns`);
}

const outputDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'output');

for (const D of depths) {
  console.error(`\n=== Depth ${D} ===`);
  const allResults: BoardDepthResult[] = [];
  // const allDetailed: DetailedJSON[] = [];

  for (const tb of boards) {
    console.error(`  ${tb.name}...`);
    const result = analyzeBoard(tb, D, patternsByN);
    allResults.push(result);
    // allDetailed.push(buildDetailedJSON(result));
  }

  // Write detailed JSON
  // const jsonPath = path.join(outputDir, `3.23-4-prefix-set-enum-D${D}.json`);
  // const jsonPath = path.join(outputDir, `3.23-5-prefix-set-FD-enum-D${D}.json`);
  // fs.writeFileSync(jsonPath, JSON.stringify(allDetailed, null, 2) + '\n');
  // console.error(`  Detailed output → ${path.basename(jsonPath)}`);

  // Print summary
  console.log(`\n# Prefix Set Enumeration — D=${D}\n`);
  printSummary(allResults);
}
