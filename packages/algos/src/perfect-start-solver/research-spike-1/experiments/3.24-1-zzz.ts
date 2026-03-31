import {
  TimingEntry,
  type TimingTableConfig,
  buildTimingEntries,
} from '@/perfect-start-solver/custom-algo-1/timing-table';

const config: TimingTableConfig = {
  maxTicks: 50,
  maxBurst: 16,
  maxBursts: 6,
  maxOverlapPerBurst: 3,
};

function main() {
  const allEntries = buildTimingEntries(23, config);

  const entriesByLen = new Map<number, TimingEntry[]>();

  for (let entry of allEntries) {
    const len = entry.overlaps.length;
    const entries = entriesByLen.get(len) || [];
    entries.push(entry);
    entriesByLen.set(len, entries);
  }

  const lens = Array.from(entriesByLen.keys());
  lens.sort((a, b) => a - b);
  for (let L of lens) {
    console.log(`len=${L} - ${(entriesByLen.get(L) || []).length}`);
  }

  console.log('buildTimingEntries(24) -> num entries:', allEntries.length);

  console.log();
  for (let e of entriesByLen.get(4) || []) {
    console.log(e);
  }

  // console.log('buildTimingEntries(24) -> num entries:', allEntries.length);
  // for (let i=0; i<10; i++) {
  //   let idx = Math.floor(Math.random() * allEntries.length)
  //   console.log(allEntries[idx]);
  // }
}

main();
