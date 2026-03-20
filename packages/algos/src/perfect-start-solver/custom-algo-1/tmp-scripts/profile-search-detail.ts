// Detailed profiling of the search function internals.
// Copies the search logic with added counters + section timers.
// Usage: npx tsx profile-search-detail.ts [boardName]

import { Board } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { allBoards } from '../../test-boards';
import { genPathsDP } from '../gen-paths';
import {
  buildPathEntries,
  countPrefixOverlap,
  type PathEntry,
  type PathEntriesByLen,
} from '../path-search';
import { genValidBurstPatterns } from '../burst-patterns';
import { simulateOneBurst, type TimingState } from '../get-burst-info';
import { popcount } from '../bitmask';

const MAX_TICKS = 50;
const MAX_BURST = 12;
const MAX_BURSTS = 8;
const MAX_OVERLAP_PER_BURST = 3;

// ── Counters ──

interface Counters {
  searchCalls: number[]; // calls per burst depth
  timingChecks: number; // simulateOneBurst calls
  timingFails: number; // timing failures (→ break)
  mapLookups: number; // entriesByLen.get() calls
  mapMisses: number; // entriesByLen.get() → undefined

  // overlap=0 branch
  ovlp0Checks: number; // BigInt AND checks
  ovlp0Passes: number; // passed → recursive call

  // overlap>0 branch
  ovlpGt0PopcountChecks: number; // popcount checks
  ovlpGt0PopcountPasses: number; // passed popcount → countPrefixOverlap
  ovlpGt0PrefixPasses: number; // passed countPrefixOverlap → recursive call

  // BigInt operations in recursion setup
  unionOps: number; // coveredMask | newTilesMask
  andNotOps: number; // cand.mask & ~coveredMask
}

function makeCounters(numBursts: number): Counters {
  return {
    searchCalls: new Array(numBursts + 1).fill(0),
    timingChecks: 0,
    timingFails: 0,
    mapLookups: 0,
    mapMisses: 0,
    ovlp0Checks: 0,
    ovlp0Passes: 0,
    ovlpGt0PopcountChecks: 0,
    ovlpGt0PopcountPasses: 0,
    ovlpGt0PrefixPasses: 0,
    unionOps: 0,
    andNotOps: 0,
  };
}

// ── Instrumented search ──

function profiledFindPaths(
  entriesByLen: PathEntriesByLen,
  burstPattern: number[],
  counters: Counters,
): boolean {
  const maxTicks = MAX_TICKS;
  const maxOverlapPerBurst = MAX_OVERLAP_PER_BURST;

  function search(
    burstIdx: number,
    coveredMask: bigint,
    timingState: TimingState,
  ): boolean {
    counters.searchCalls[burstIdx]++;
    if (burstIdx === burstPattern.length) return true;

    const captures = burstPattern[burstIdx];
    const maxOverlap = burstIdx > 0 ? maxOverlapPerBurst : 0;

    for (let overlap = 0; overlap <= maxOverlap; overlap++) {
      const moves = captures + overlap;

      counters.timingChecks++;
      const timingResult = simulateOneBurst(captures, moves, timingState, maxTicks);
      if (!timingResult) {
        counters.timingFails++;
        break;
      }

      counters.mapLookups++;
      const candidates = entriesByLen.get(moves);
      if (!candidates) {
        counters.mapMisses++;
        continue;
      }

      for (const cand of candidates) {
        if (overlap === 0) {
          counters.ovlp0Checks++;
          if ((cand.mask & coveredMask) !== 0n) continue;
          counters.ovlp0Passes++;
        } else {
          counters.ovlpGt0PopcountChecks++;
          const overlapBits = cand.mask & coveredMask;
          if (popcount(overlapBits) !== overlap) continue;
          counters.ovlpGt0PopcountPasses++;
          const prefixLen = countPrefixOverlap(cand.tiles, coveredMask);
          if (prefixLen !== overlap) continue;
          counters.ovlpGt0PrefixPasses++;
        }

        counters.andNotOps++;
        const newTilesMask = overlap > 0 ? cand.mask & ~coveredMask : cand.mask;
        counters.unionOps++;
        const result = search(
          burstIdx + 1,
          coveredMask | newTilesMask,
          timingResult.nextState,
        );
        if (result) return true;
      }
    }

    return false;
  }

  return search(0, 0n, { tick: 1, generalTroops: 1 });
}

// ── Run ──

const boardName = process.argv[2] || 'corridor-7x7';
const testBoard = allBoards().find((b) => b.name === boardName)!;
if (!testBoard) {
  console.error('Board not found:', boardName);
  process.exit(1);
}

const board = fromBoardState(testBoard.board, 1);
const generalPos = Board.toIndex(
  board,
  testBoard.generalCoord.x,
  testBoard.generalCoord.y,
);
const pathsByLen = genPathsDP(board, generalPos, MAX_BURST + 1);
const entries = buildPathEntries(pathsByLen);

console.log(`=== ${boardName} ===\n`);

const patterns = genValidBurstPatterns(24, MAX_BURST, MAX_TICKS, MAX_BURSTS);

for (const pattern of patterns) {
  if (pattern.some((len) => !entries.has(len))) continue;

  const counters = makeCounters(pattern.length);
  const t0 = performance.now();
  const found = profiledFindPaths(entries, pattern, counters);
  const ms = performance.now() - t0;

  console.log(
    `pattern ${JSON.stringify(pattern)}: ${ms.toFixed(0)}ms ${found ? 'FOUND' : 'miss'}`,
  );
  console.log(`  search calls by depth: ${counters.searchCalls.join(', ')}`);
  console.log(`  timing: ${counters.timingChecks} checks, ${counters.timingFails} fails`);
  console.log(`  map: ${counters.mapLookups} lookups, ${counters.mapMisses} misses`);
  console.log(
    `  overlap=0: ${counters.ovlp0Checks} checks → ${counters.ovlp0Passes} passes`,
  );
  console.log(
    `  overlap>0: ${counters.ovlpGt0PopcountChecks} popcount checks` +
      ` → ${counters.ovlpGt0PopcountPasses} popcount passes` +
      ` → ${counters.ovlpGt0PrefixPasses} prefix passes`,
  );
  console.log(`  bigint ops: ${counters.unionOps} unions, ${counters.andNotOps} andNots`);
  console.log();

  if (found) break;
}
