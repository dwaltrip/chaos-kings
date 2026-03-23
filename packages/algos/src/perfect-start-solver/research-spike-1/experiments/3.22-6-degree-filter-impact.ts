// Quick experiment: what fraction of timing entries at each capture target
// have N zero-overlap bursts? Cross-reference with board general degrees
// to estimate degree-based filtering impact.
//
// Usage: npx tsx src/perfect-start-solver/research-spike-1/experiments/3.22-6-degree-filter-impact.ts

import { Board, TileType } from '@/core-next/flat-board';
import { Direction } from '@core/types';
import { fromBoardState } from '@/core-next/convert';

import { buildTimingEntries, type TimingEntry } from '../../custom-algo-1/timing-table';
import { slowSearch, type TestBoard } from '../../test-boards';

const config = {
  maxTicks: 50,
  maxBurst: 12,
  maxBursts: 6,
  maxOverlapPerBurst: 3,
};

// ── Part 1: Zero-overlap burst distribution in timing entries ──

console.log('# Zero-overlap burst count distribution in timing entries\n');
console.log('(Board-independent — same config, same entries)\n');

for (const cap of [24, 23, 22, 21, 20]) {
  const entries = buildTimingEntries(cap, config);
  const counts = new Map<number, number>();

  for (const e of entries) {
    const zeroOverlap = e.overlaps.filter((o) => o === 0).length;
    counts.set(zeroOverlap, (counts.get(zeroOverlap) ?? 0) + 1);
  }

  console.log(`## cap=${cap} (${entries.length} entries)`);
  const sorted = [...counts.entries()].sort((a, b) => a[0] - b[0]);
  for (const [zob, count] of sorted) {
    const pct = ((count / entries.length) * 100).toFixed(1);
    console.log(`  ${zob} zero-overlap bursts: ${count} entries (${pct}%)`);
  }

  // Cumulative: entries with > N zero-overlap bursts
  console.log('  ---');
  for (let d = 2; d <= 4; d++) {
    const killed = [...counts.entries()]
      .filter(([zob]) => zob > d)
      .reduce((s, [, c]) => s + c, 0);
    const pct = ((killed / entries.length) * 100).toFixed(1);
    console.log(
      `  degree ${d} would kill: ${killed}/${entries.length} entries (${pct}%)`,
    );
  }
  console.log();
}

// ── Part 2: General degree on slow boards ──

console.log('\n# General degree on slow boards\n');

const DIRECTIONS = [Direction.LEFT, Direction.UP, Direction.RIGHT, Direction.DOWN];

const boards = slowSearch();
for (const tb of boards) {
  const board = fromBoardState(tb.board, 1);
  const gi = Board.toIndex(board, tb.generalCoord.x, tb.generalCoord.y);
  let degree = 0;
  for (const dir of DIRECTIONS) {
    const next = Board.neighbor(board, gi, dir);
    if (!Board.isValidIndex(board, next)) continue;
    if (board.types[next] === TileType.MOUNTAIN) continue;
    degree++;
  }
  console.log(`  ${tb.name}: degree ${degree}`);
}
