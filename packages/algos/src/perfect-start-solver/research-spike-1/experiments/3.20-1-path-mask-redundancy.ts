// 1.3 Path Mask Redundancy Analysis
// Usage: npx tsx src/perfect-start-solver/research-spike-1/experiments/3.20-1-path-mask-redundancy.ts

import { Board } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { genPathsDP } from '../../custom-algo-1/gen-paths';
import { buildPathEntries } from '../../custom-algo-1/path-search';
import { popcount } from '../../custom-algo-1/bitmask';
import { allBoards } from '../../test-boards';

const MAX_LEN = 13; // maxBurst (12) + 1, matching solver default

// ---------------------------------------------------------------------------
// Analysis 1: Mask redundancy per board per length
// ---------------------------------------------------------------------------

interface LenStats {
  len: number;
  paths: number;
  masks: number;
  ratio: number;
  dominatedMasks: number;
  dominatedPaths: number;
  classBuckets: { one: number; low: number; mid: number; high: number; mega: number };
}

function analyzeMaskRedundancy(
  entriesByLen: Map<number, { tiles: number[]; mask: bigint }[]>,
): LenStats[] {
  const results: LenStats[] = [];

  for (let len = 1; len <= 12; len++) {
    const entries = entriesByLen.get(len);
    if (!entries || entries.length === 0) {
      results.push({
        len,
        paths: 0,
        masks: 0,
        ratio: 0,
        dominatedMasks: 0,
        dominatedPaths: 0,
        classBuckets: { one: 0, low: 0, mid: 0, high: 0, mega: 0 },
      });
      continue;
    }

    // Group by mask
    const maskGroups = new Map<string, number>();
    for (const e of entries) {
      const key = e.mask.toString();
      maskGroups.set(key, (maskGroups.get(key) ?? 0) + 1);
    }

    // Class size distribution
    const buckets = { one: 0, low: 0, mid: 0, high: 0, mega: 0 };
    for (const count of maskGroups.values()) {
      if (count === 1) buckets.one++;
      else if (count <= 5) buckets.low++;
      else if (count <= 20) buckets.mid++;
      else if (count <= 100) buckets.high++;
      else buckets.mega++;
    }

    results.push({
      len,
      paths: entries.length,
      masks: maskGroups.size,
      ratio: entries.length / maskGroups.size,
      dominatedMasks: 0, // filled in by analysis 3
      dominatedPaths: 0,
      classBuckets: buckets,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Analysis 2: Overlap-aware equivalence classes
// ---------------------------------------------------------------------------

interface OverlapStats {
  len: number;
  paths: number;
  maskOnly: number;
  prefix1: number;
  prefix2: number;
  prefix3: number;
}

function analyzeOverlapClasses(
  entriesByLen: Map<number, { tiles: number[]; mask: bigint }[]>,
): OverlapStats[] {
  const results: OverlapStats[] = [];

  for (let len = 1; len <= 12; len++) {
    const entries = entriesByLen.get(len);
    if (!entries || entries.length === 0) {
      results.push({ len, paths: 0, maskOnly: 0, prefix1: 0, prefix2: 0, prefix3: 0 });
      continue;
    }

    const maskKeys = new Set<string>();
    const p1Keys = new Set<string>();
    const p2Keys = new Set<string>();
    const p3Keys = new Set<string>();

    for (const e of entries) {
      const ms = e.mask.toString();
      maskKeys.add(ms);
      if (e.tiles.length >= 1) p1Keys.add(`${ms}:${e.tiles[0]}`);
      if (e.tiles.length >= 2) p2Keys.add(`${ms}:${e.tiles[0]},${e.tiles[1]}`);
      if (e.tiles.length >= 3)
        p3Keys.add(`${ms}:${e.tiles[0]},${e.tiles[1]},${e.tiles[2]}`);
    }

    results.push({
      len,
      paths: entries.length,
      maskOnly: maskKeys.size,
      prefix1: p1Keys.size,
      prefix2: p2Keys.size,
      prefix3: p3Keys.size,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Analysis 3: Dominated masks
// ---------------------------------------------------------------------------

function analyzeDominatedMasks(
  entriesByLen: Map<number, { tiles: number[]; mask: bigint }[]>,
  lenStats: LenStats[],
): void {
  for (const stat of lenStats) {
    const entries = entriesByLen.get(stat.len);
    if (!entries || entries.length === 0) continue;

    // Collect distinct masks with their popcount and path count
    const maskMap = new Map<string, { mask: bigint; count: number; pop: number }>();
    for (const e of entries) {
      const key = e.mask.toString();
      if (!maskMap.has(key)) {
        maskMap.set(key, { mask: e.mask, count: 1, pop: popcount(e.mask) });
      } else {
        maskMap.get(key)!.count++;
      }
    }

    // Sort by popcount ascending — a dominated mask must have fewer bits
    const masks = [...maskMap.values()].sort((a, b) => a.pop - b.pop);

    let dominatedMaskCount = 0;
    let dominatedPathCount = 0;

    for (let i = 0; i < masks.length; i++) {
      const a = masks[i];
      // Check if any mask with more bits is a strict superset
      for (let j = i + 1; j < masks.length; j++) {
        const b = masks[j];
        if (b.pop <= a.pop) continue; // can't be a strict superset with same or fewer bits
        if ((a.mask & b.mask) === a.mask) {
          dominatedMaskCount++;
          dominatedPathCount += a.count;
          break; // mask i is dominated, move on
        }
      }
    }

    stat.dominatedMasks = dominatedMaskCount;
    stat.dominatedPaths = dominatedPathCount;
  }
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

function pad(s: string | number, width: number): string {
  return String(s).padStart(width);
}

function fmtRatio(r: number): string {
  if (r === 0) return '   -';
  return r.toFixed(1).padStart(6) + 'x';
}

function printRedundancyTable(boardName: string, stats: LenStats[]): void {
  console.log(`\n=== ${boardName} ===`);
  console.log(
    ' Len |  Paths | Masks | Ratio   | Dom.M | Dom.P |   1  | 2-5  | 6-20 |21-100| 100+ ',
  );
  console.log(
    '-----|--------|-------|---------|-------|-------|------|------|------|------|------',
  );

  let totalPaths = 0;
  let totalMasks = 0;

  for (const s of stats) {
    if (s.paths === 0) continue;
    totalPaths += s.paths;
    totalMasks += s.masks;
    const b = s.classBuckets;
    console.log(
      ` ${pad(s.len, 3)} |${pad(s.paths, 7)} |${pad(s.masks, 6)} | ${fmtRatio(s.ratio)} |${pad(s.dominatedMasks, 6)} |${pad(s.dominatedPaths, 6)} |${pad(b.one, 5)} |${pad(b.low, 5)} |${pad(b.mid, 5)} |${pad(b.high, 5)} |${pad(b.mega, 5)}`,
    );
  }

  const overallRatio = totalMasks > 0 ? totalPaths / totalMasks : 0;
  console.log(
    '-----|--------|-------|---------|-------|-------|------|------|------|------|------',
  );
  console.log(
    ` ALL |${pad(totalPaths, 7)} |${pad(totalMasks, 6)} | ${fmtRatio(overallRatio)} |       |       |      |      |      |      |     `,
  );
}

function printOverlapTable(boardName: string, stats: OverlapStats[]): void {
  console.log(`\n--- ${boardName}: overlap-aware classes ---`);
  console.log(' Len | Paths  | Mask  | +pfx1 | +pfx2 | +pfx3 ');
  console.log('-----|--------|-------|-------|-------|-------');

  for (const s of stats) {
    if (s.paths === 0) continue;
    console.log(
      ` ${pad(s.len, 3)} |${pad(s.paths, 7)} |${pad(s.maskOnly, 6)} |${pad(s.prefix1, 6)} |${pad(s.prefix2, 6)} |${pad(s.prefix3, 6)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Cross-board summary
// ---------------------------------------------------------------------------

interface BoardSummary {
  name: string;
  totalPaths: number;
  totalMasks: number;
  ratio: number;
  dominatedMasks: number;
  dominatedPaths: number;
  maxRatioLen: number;
  maxRatio: number;
}

function printCrossBoardSummary(summaries: BoardSummary[]): void {
  console.log('\n\n========================================');
  console.log('  CROSS-BOARD SUMMARY');
  console.log('========================================');
  console.log(
    ' Board                       | Paths   | Masks  | Ratio   | Dom.M | Dom.P | Peak Len (Ratio)',
  );
  console.log(
    '-----------------------------|---------|--------|---------|-------|-------|------------------',
  );

  for (const s of summaries) {
    const peak = `${s.maxRatioLen} (${s.maxRatio.toFixed(1)}x)`;
    console.log(
      ` ${s.name.padEnd(28)}|${pad(s.totalPaths, 8)} |${pad(s.totalMasks, 7)} | ${fmtRatio(s.ratio)} |${pad(s.dominatedMasks, 6)} |${pad(s.dominatedPaths, 6)} | ${peak}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const boards = allBoards();
  const summaries: BoardSummary[] = [];

  for (const testBoard of boards) {
    const board = fromBoardState(testBoard.board, 1);
    const generalPos = Board.toIndex(
      board,
      testBoard.generalCoord.x,
      testBoard.generalCoord.y,
    );

    const genPaths = genPathsDP(board, generalPos, MAX_LEN);
    const entriesByLen = buildPathEntries(genPaths);

    // Analysis 1: mask redundancy
    const lenStats = analyzeMaskRedundancy(entriesByLen);

    // Analysis 3: dominated masks (mutates lenStats)
    analyzeDominatedMasks(entriesByLen, lenStats);

    // Analysis 2: overlap classes
    const overlapStats = analyzeOverlapClasses(entriesByLen);

    // Print per-board tables
    printRedundancyTable(testBoard.name, lenStats);
    printOverlapTable(testBoard.name, overlapStats);

    // Collect summary
    let totalPaths = 0;
    let totalMasks = 0;
    let totalDomMasks = 0;
    let totalDomPaths = 0;
    let maxRatio = 0;
    let maxRatioLen = 0;

    for (const s of lenStats) {
      totalPaths += s.paths;
      totalMasks += s.masks;
      totalDomMasks += s.dominatedMasks;
      totalDomPaths += s.dominatedPaths;
      if (s.ratio > maxRatio) {
        maxRatio = s.ratio;
        maxRatioLen = s.len;
      }
    }

    summaries.push({
      name: testBoard.name,
      totalPaths,
      totalMasks,
      ratio: totalMasks > 0 ? totalPaths / totalMasks : 0,
      dominatedMasks: totalDomMasks,
      dominatedPaths: totalDomPaths,
      maxRatioLen,
      maxRatio,
    });
  }

  printCrossBoardSummary(summaries);
}

main();
