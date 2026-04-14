// Explore timing entries for the 6x6 pocket board.
//
// The board has 34 walkable tiles (36 - 2 mountains).
// With burst-1 capturing 7 tiles, what burst patterns are feasible
// for the remaining captures at different max_tick values?

import { buildTimingEntries, type TimingEntry } from '../custom-algo-1/timing-table';
import { getBurstInfosFromSpecs } from '../custom-algo-1/get-burst-info';

// ── First: what does a 7-tile burst-1 look like timing-wise? ──

console.log('=== Burst-1 timing (7 captures, 0 overlap) ===\n');

const burst1Info = getBurstInfosFromSpecs([{ moves: 7, captures: 7 }], 50);
if (burst1Info) {
  const b = burst1Info[0];
  console.log(`  Start tick: ${b.startTick}, End tick: ${b.endTick}`);
  console.log(`  Army needed: 8 (7 captures + 1 left behind)`);
  console.log(`  Wait until tick ${b.startTick} for 8 army, then 7 moves`);
}

// ── Explore different max_tick values ──

// For each max_tick, generate all valid timing entries for various capture targets.
// We want to understand: after a 7-tile burst-1 (ending ~tick 21), what's possible?

const MAX_TICKS_TO_TRY = [25, 30, 35, 40];
const CAPTURE_TARGETS = [10, 12, 14, 16, 18, 20];

console.log('\n=== Timing entries by (max_tick, total_captures) ===\n');
console.log('Entry count = number of valid (captures[], overlaps[]) combos');
console.log('that fit within the tick budget.\n');

const headerCols = CAPTURE_TARGETS.map((c) => `cap=${c}`.padStart(8));
console.log(`max_tick │ ${headerCols.join(' │ ')}`);
console.log(`────────┼${CAPTURE_TARGETS.map(() => '─────────').join('┼')}`);

for (const maxTick of MAX_TICKS_TO_TRY) {
  const counts = CAPTURE_TARGETS.map((target) => {
    const entries = buildTimingEntries(target, {
      maxTicks: maxTick,
      maxBurst: target, // no per-burst cap
      maxBursts: 6,
      maxOverlapPerBurst: 4,
    });
    return String(entries.length).padStart(8);
  });
  console.log(`${String(maxTick).padStart(7)} │ ${counts.join(' │ ')}`);
}

// ── Detailed entries for a chosen max_tick ──

const CHOSEN_MAX_TICK = 30;
const CHOSEN_TARGETS = [10, 12, 14, 16];

console.log(`\n=== Detailed entries for max_tick=${CHOSEN_MAX_TICK} ===\n`);

for (const target of CHOSEN_TARGETS) {
  const entries = buildTimingEntries(target, {
    maxTicks: CHOSEN_MAX_TICK,
    maxBurst: target,
    maxBursts: 6,
    maxOverlapPerBurst: 4,
  });

  console.log(`--- ${target} captures (${entries.length} entries) ---`);

  if (entries.length === 0) {
    console.log('  (none)\n');
    continue;
  }

  // Show entries grouped by burst count
  const byBurstCount = new Map<number, TimingEntry[]>();
  for (const e of entries) {
    const k = e.captures.length;
    if (!byBurstCount.has(k)) byBurstCount.set(k, []);
    byBurstCount.get(k)!.push(e);
  }

  for (const [k, group] of [...byBurstCount.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${k} bursts: ${group.length} entries`);
    // Show first few zero-overlap entries and first few with overlap
    const zeroOvl = group.filter((e) => e.overlaps.every((o) => o === 0));
    const withOvl = group.filter((e) => e.overlaps.some((o) => o > 0));

    if (zeroOvl.length > 0) {
      console.log(`    Zero-overlap (${zeroOvl.length}):`);
      for (const e of zeroOvl.slice(0, 5)) {
        console.log(
          `      caps=[${e.captures.join(',')}] ovl=[${e.overlaps.join(',')}] endTick=${e.endTick}`,
        );
      }
      if (zeroOvl.length > 5) console.log(`      ... and ${zeroOvl.length - 5} more`);
    }
    if (withOvl.length > 0) {
      console.log(`    With overlap (${withOvl.length}):`);
      for (const e of withOvl.slice(0, 5)) {
        console.log(
          `      caps=[${e.captures.join(',')}] ovl=[${e.overlaps.join(',')}] endTick=${e.endTick}`,
        );
      }
      if (withOvl.length > 5) console.log(`      ... and ${withOvl.length - 5} more`);
    }
  }
  console.log();
}

// ── Focus: entries where burst-1 = 7 captures ──

console.log(`=== Entries with burst-1 = 7 captures (max_tick=${CHOSEN_MAX_TICK}) ===\n`);

for (const target of CHOSEN_TARGETS) {
  const entries = buildTimingEntries(target, {
    maxTicks: CHOSEN_MAX_TICK,
    maxBurst: target,
    maxBursts: 6,
    maxOverlapPerBurst: 4,
  });

  const b1_7 = entries.filter((e) => e.captures[0] === 7);

  console.log(`--- ${target} captures: ${b1_7.length} entries with burst-1=7 ---`);
  for (const e of b1_7.slice(0, 10)) {
    const totalOvl = e.overlaps.reduce((a, b) => a + b, 0);
    console.log(
      `  caps=[${e.captures.join(',')}] ovl=[${e.overlaps.join(',')}] ` +
        `totalOvl=${totalOvl} endTick=${e.endTick}`,
    );
  }
  if (b1_7.length > 10) console.log(`  ... and ${b1_7.length - 10} more`);
  console.log();
}
