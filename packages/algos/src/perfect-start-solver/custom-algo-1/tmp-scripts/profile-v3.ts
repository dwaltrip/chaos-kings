// Detailed profiling of solver-v3 on a specific board.
// Shows per-capture-level, per-group, and per-candidate stats.
//
// Usage: npx tsx profile-v3.ts corner-9x9

import { Board } from '@/core-next/flat-board';
import { fromBoardState } from '@/core-next/convert';

import { allBoards } from '../../test-boards';
import { popcount } from '../bitmask';
import { genPathsDP } from '../gen-paths';
import {
  buildPathEntries,
  countPrefixOverlap,
  type PathEntry,
  type PathEntriesByLen,
} from '../path-search';
import {
  buildTimingEntries,
  type TimingEntry,
  type TimingTableConfig,
} from '../timing-table';

const boardName = process.argv[2] || 'corner-9x9';
const testBoard = allBoards().find((b) => b.name === boardName);
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

const MAX_BURST = 12;
const timingConfig: TimingTableConfig = {
  maxTicks: 50,
  maxBurst: MAX_BURST,
  maxBursts: 6,
  maxOverlapPerBurst: 3,
};

const pathsByLen = genPathsDP(board, generalPos, MAX_BURST + 1);
const entriesByLen = buildPathEntries(pathsByLen);

let totalPaths = 0;
for (const [, entries] of entriesByLen) totalPaths += entries.length;
console.log(`=== ${boardName} ===`);
console.log(`  ${totalPaths.toLocaleString()} total paths`);
for (const [len, entries] of [...entriesByLen.entries()].sort((a, b) => b[0] - a[0])) {
  console.log(`    len ${String(len).padStart(2)}: ${entries.length.toLocaleString()}`);
}
console.log();

// counters
let totalForwardChecks = 0;
let totalForwardPrunes = 0;
let totalSearchCalls = 0;
let totalSearchCallsByDepth: number[] = [0, 0, 0, 0, 0, 0, 0, 0];

function hasViableBurst2(
  entry: TimingEntry,
  coveredMask: bigint,
  ebl: PathEntriesByLen,
): boolean {
  totalForwardChecks++;
  if (entry.captures.length < 2) return true;
  const moveLen = entry.captures[1] + entry.overlaps[1];
  const overlap = entry.overlaps[1];
  const candidates = ebl.get(moveLen);
  if (!candidates) {
    totalForwardPrunes++;
    return false;
  }
  for (const cand of candidates) {
    if (overlap === 0) {
      if ((cand.mask & coveredMask) === 0n) return true;
    } else {
      if (popcount(cand.mask & coveredMask) !== overlap) continue;
      if (countPrefixOverlap(cand.tiles, coveredMask) === overlap) return true;
    }
  }
  totalForwardPrunes++;
  return false;
}

function searchRemaining(
  ebl: PathEntriesByLen,
  entry: TimingEntry,
  moves: number[],
  burstIdx: number,
  coveredMask: bigint,
): PathEntry[] | null {
  totalSearchCalls++;
  if (burstIdx < totalSearchCallsByDepth.length) totalSearchCallsByDepth[burstIdx]++;
  if (burstIdx === moves.length) return [];
  const moveLen = moves[burstIdx];
  const overlap = entry.overlaps[burstIdx];
  const candidates = ebl.get(moveLen);
  if (!candidates) return null;
  for (const cand of candidates) {
    if (overlap === 0) {
      if ((cand.mask & coveredMask) !== 0n) continue;
    } else {
      if (popcount(cand.mask & coveredMask) !== overlap) continue;
      if (countPrefixOverlap(cand.tiles, coveredMask) !== overlap) continue;
    }
    const newTiles = overlap > 0 ? cand.mask & ~coveredMask : cand.mask;
    const rest = searchRemaining(ebl, entry, moves, burstIdx + 1, coveredMask | newTiles);
    if (rest) {
      rest.unshift(cand);
      return rest;
    }
  }
  return null;
}

interface TimingGroup {
  burst1Moves: number;
  entries: TimingEntry[];
}

for (let captures = 24; captures >= 20; captures--) {
  const capStart = performance.now();
  const allEntries = buildTimingEntries(captures, timingConfig);

  const byB1 = new Map<number, TimingEntry[]>();
  for (const e of allEntries) {
    const b1 = e.captures[0];
    if (!byB1.has(b1)) byB1.set(b1, []);
    byB1.get(b1)!.push(e);
  }
  const groups: TimingGroup[] = [];
  for (const [b1, ge] of byB1) groups.push({ burst1Moves: b1, entries: ge });
  groups.sort((a, b) => b.burst1Moves - a.burst1Moves);

  console.log(
    `--- ${captures} captures: ${allEntries.length} entries, ${groups.length} groups ---`,
  );

  let entriesChecked = 0;
  let found = false;

  for (const group of groups) {
    const candidates = entriesByLen.get(group.burst1Moves);
    if (!candidates) continue;

    const entryMoves = group.entries.map((entry) =>
      entry.captures.map((c, i) => c + entry.overlaps[i]),
    );
    const viableEntryIndices: number[] = [];
    for (let ei = 0; ei < group.entries.length; ei++) {
      if (entryMoves[ei].every((m, i) => i === 0 || entriesByLen.has(m))) {
        viableEntryIndices.push(ei);
      }
    }
    if (viableEntryIndices.length === 0) continue;

    const groupStart = performance.now();
    const prevForwardChecks = totalForwardChecks;
    const prevForwardPrunes = totalForwardPrunes;
    const prevSearchCalls = totalSearchCalls;
    let groupEntriesChecked = 0;
    let candsChecked = 0;
    let candsPruned = 0;

    for (const cand of candidates) {
      candsChecked++;
      const coveredMask = cand.mask;
      let candHadViable = false;

      for (const ei of viableEntryIndices) {
        const entry = group.entries[ei];
        const moves = entryMoves[ei];
        if (!hasViableBurst2(entry, coveredMask, entriesByLen)) continue;
        candHadViable = true;

        entriesChecked++;
        groupEntriesChecked++;
        const rest = searchRemaining(entriesByLen, entry, moves, 1, coveredMask);
        if (rest) {
          const groupMs = performance.now() - groupStart;
          console.log(
            `  b1=${group.burst1Moves}: FOUND at cand ${candsChecked}/${candidates.length}, ` +
              `${groupEntriesChecked} entries searched, ${groupMs.toFixed(0)}ms`,
          );
          console.log(
            `    fwd checks: ${totalForwardChecks - prevForwardChecks}, ` +
              `pruned: ${totalForwardPrunes - prevForwardPrunes}, ` +
              `search calls: ${totalSearchCalls - prevSearchCalls}`,
          );
          found = true;
          break;
        }
      }
      if (found) break;
      if (!candHadViable) candsPruned++;
    }

    if (!found) {
      const groupMs = performance.now() - groupStart;
      const fwdChecks = totalForwardChecks - prevForwardChecks;
      const fwdPrunes = totalForwardPrunes - prevForwardPrunes;
      const searchCalls = totalSearchCalls - prevSearchCalls;
      const prunePct =
        candidates.length > 0
          ? ((candsPruned / candidates.length) * 100).toFixed(0)
          : '0';
      console.log(
        `  b1=${group.burst1Moves}: miss — ` +
          `${candidates.length} cands (${prunePct}% fully pruned), ` +
          `${viableEntryIndices.length} viable entries, ` +
          `${groupEntriesChecked} entries searched, ${groupMs.toFixed(0)}ms`,
      );
      console.log(
        `    fwd checks: ${fwdChecks}, pruned: ${fwdPrunes}, search calls: ${searchCalls}`,
      );
    }

    if (found) break;
  }

  const capMs = performance.now() - capStart;
  if (found) {
    console.log(
      `  → FOUND in ${capMs.toFixed(0)}ms, ${entriesChecked} entries checked total`,
    );
  } else {
    console.log(
      `  → exhausted in ${capMs.toFixed(0)}ms, ${entriesChecked} entries checked`,
    );
  }
  console.log();

  if (found) break;
}

console.log(
  'Search calls by depth:',
  totalSearchCallsByDepth.filter((x) => x > 0).join(', '),
);
