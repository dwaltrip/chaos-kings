import { Board } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { slowSearch, TestBoard } from '../../test-boards';
import { getWalkableNeighbors } from '../../utils/board-graph';

import { buildTimingEntries } from '../../custom-algo-1/timing-table';
import { enumeratePrefixes, enumeratePrefixSets } from '../prefix-utils';

type PatternsByLen = Map<number, number[][]>;

const SLOW_BOARDS = slowSearch();

const D = 4;
const MAX_PATH_LEN = 12;

function analyzeBoard(tb: TestBoard, patternsByN: PatternsByLen) {
  const board = fromBoardState(tb.board, 1);
  const gp = Board.toIndex(board, tb.generalCoord.x, tb.generalCoord.y);
  const { prefixesByDepth } = enumeratePrefixes(board, gp, D, MAX_PATH_LEN);

  // For each N=4,5,6, enumerate all sets and check for dead tips
  console.log('## ' + tb.name);

  for (const N of [4, 5, 6]) {
    const patterns = patternsByN.get(N) ?? [];
    let totalSets = 0;
    let deadTipCounts = 0;

    for (const overlaps of patterns) {
      const result = enumeratePrefixSets(prefixesByDepth, overlaps, D);
      for (const s of result.sets) {
        totalSets++;
        // Collect all tiles across all prefixes in this set + the general
        const allTiles = new Set([gp]);
        for (const tiles of s.prefixTiles) {
          for (const t of tiles) allTiles.add(t);
        }

        let hasDead = false;
        for (const tiles of s.prefixTiles) {
          const tip = tiles[tiles.length - 1];
          const neighbors = getWalkableNeighbors(board, tip);
          const free = neighbors.filter((nb) => !allTiles.has(nb)).length;
          if (free === 0) {
            hasDead = true;
            break;
          }
        }
        if (hasDead) deadTipCounts++;
      }
    }

    const pct = totalSets > 0 ? ((deadTipCounts / totalSets) * 100).toFixed(1) : '-';
    console.log(`  N=${N}: ${deadTipCounts}/${totalSets}`, `have a dead tip (${pct}%)`);
  }
  console.log();
}

function main() {
  // Get unique overlap patterns (same as experiment)
  const config = { maxTicks: 50, maxBurst: 12, maxBursts: 6, maxOverlapPerBurst: 3 };
  const seen = new Set<string>();
  const patternsByN: PatternsByLen = new Map();

  for (let cap = 20; cap <= 24; cap++) {
    for (const entry of buildTimingEntries(cap, config)) {
      const key = entry.overlaps.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      const N = entry.overlaps.length;
      if (!patternsByN.has(N)) patternsByN.set(N, []);
      patternsByN.get(N)!.push(entry.overlaps);
    }
  }

  for (const testBoard of SLOW_BOARDS) {
    analyzeBoard(testBoard, patternsByN);
  }
}

main();
