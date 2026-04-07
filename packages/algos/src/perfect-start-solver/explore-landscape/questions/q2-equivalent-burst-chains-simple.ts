/*
  Equivalent Burst Chains (simple corridor version)

  Model:
  - 1xN corridor, general at x=0
  - Each burst goes from x=0 to some depth (> current frontier)
  - Re-traversals: moves through owned tiles (0..frontier), cost ticks but not army
  - New tile captures: each costs 1 army
  - Army needed = burstSize + 1 (captures + 1 left behind)
  - Total moves per burst = frontier + burstSize
  - After burst: generalArmy = 1 + production ticks during burst

  A chain = sequence of burst sizes [s1, s2, ..., sn].
  Frontier after chain = sum of all sizes.
  Two chains are equivalent if they produce the same (tick, generalArmy, frontier).
*/

import * as fs from 'fs';
import * as path from 'path';

import { countProductionTicks } from '../abstract-moves';
import { tickForGeneralArmy } from '../helpers';
import { MAX_TICK } from '../constants';
import { formatTable } from '@/utils/format';
import { writeJson } from '@/utils/json';

interface CorridorState {
  tick: number;
  generalArmy: number;
  frontier: number;
}

type BurstSizeChain = number[];

interface EquivalenceGroup {
  state: CorridorState;
  chains: BurstSizeChain[];
}

function corridorBurst(state: CorridorState, burstSize: number): CorridorState {
  const armyNeeded = burstSize + 1;

  let readyTick = state.tick;
  if (state.generalArmy < armyNeeded) {
    readyTick = tickForGeneralArmy(state.tick, state.generalArmy, armyNeeded);
  }

  const totalMoves = state.frontier + burstSize;
  const firstMoveTick = readyTick + 1;
  const endTick = firstMoveTick + totalMoves - 1;
  const newUnits = countProductionTicks(firstMoveTick, endTick);

  return {
    tick: endTick,
    generalArmy: 1 + newUnits,
    frontier: state.frontier + burstSize,
  };
}

function exploreEquivalentBurstChains(maxTick: number = MAX_TICK) {
  const classesByKey = new Map<string, BurstSizeChain[]>();

  function stateKey(s: CorridorState): string {
    return `${s.tick},${s.generalArmy},${s.frontier}`;
  }

  function recurse(state: CorridorState, chain: number[]): void {
    if (chain.length > 0) {
      const key = stateKey(state);
      let group = classesByKey.get(key);
      if (!group) {
        group = [];
        classesByKey.set(key, group);
      }
      group.push([...chain]);
    }

    for (let size = 1; size <= maxTick; size++) {
      const armyNeeded = size + 1;

      let readyTick = state.tick;
      if (state.generalArmy < armyNeeded) {
        readyTick = tickForGeneralArmy(state.tick, state.generalArmy, armyNeeded);
      }
      const totalMoves = state.frontier + size;
      const endTick = readyTick + 1 + totalMoves - 1;

      if (endTick > maxTick) break;

      const nextState = corridorBurst(state, size);
      chain.push(size);
      recurse(nextState, chain);
      chain.pop();
    }
  }

  recurse({ tick: 0, generalArmy: 1, frontier: 0 }, []);

  // Build sorted equivalence groups (all groups, not just multi-chain)
  const allGroups: EquivalenceGroup[] = [];
  for (const [key, chains] of classesByKey) {
    const [tick, generalArmy, frontier] = key.split(',').map(Number);
    allGroups.push({ state: { tick, generalArmy, frontier }, chains });
  }
  allGroups.sort(
    (a, b) => a.state.frontier - b.state.frontier || a.state.tick - b.state.tick,
  );

  const equivalentGroups = allGroups.filter((g) => g.chains.length > 1);
  const totalChains = allGroups.reduce((sum, g) => sum + g.chains.length, 0);

  return { totalChains, allGroups, equivalentGroups };
}

// ---- Output helpers --------------------------------------------------------

const OUTPUT_DIR = path.resolve(__dirname, '../output/q2');

function fmtChain(chain: BurstSizeChain): string {
  return `[${chain.join(', ')}]`;
}

function writeSummary(
  totalChains: number,
  allGroups: EquivalenceGroup[],
  equivalentGroups: EquivalenceGroup[],
) {
  const lines: string[] = [
    '# Equivalent Burst Chains',
    '',
    `Corridor Model (MAX_TICK=${MAX_TICK})`,
    '\n---\n',
    `Total chains:    ${totalChains}`,
    `Unique states:   ${allGroups.length}`,
    `  - with 1 chain:   ${allGroups.length - equivalentGroups.length}`,
    `  - with 2+ chains: ${equivalentGroups.length}`,
    '',
  ];

  const rows = equivalentGroups.map(({ state, chains }) => {
    const shortest = chains.reduce((a, b) => (a.length <= b.length ? a : b));
    const longest = chains.reduce((a, b) => (a.length >= b.length ? a : b));
    return [
      String(state.frontier),
      String(state.tick),
      String(state.generalArmy),
      String(chains.length),
      fmtChain(shortest),
      fmtChain(longest),
    ];
  });
  lines.push(
    formatTable(['frontier', 'tick', 'army', 'chains', 'shortest', 'longest'], rows),
  );

  const outPath = path.join(OUTPUT_DIR, 'summary.md');
  fs.writeFileSync(outPath, lines.join('\n') + '\n');
  console.log(`  wrote ${outPath}`);
}

function writeFullData(allGroups: EquivalenceGroup[]) {
  const data = allGroups.map(({ state, chains }) => ({
    frontier: state.frontier,
    tick: state.tick,
    army: state.generalArmy,
    chainCount: chains.length,
    chains,
  }));

  const outPath = path.join(OUTPUT_DIR, 'full-data.json');
  writeJson(outPath, data);
  console.log(`  wrote ${outPath}`);
}

// ---- Main ------------------------------------------------------------------

function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const { totalChains, allGroups, equivalentGroups } = exploreEquivalentBurstChains();

  console.log(`\n  Total chains: ${totalChains}`);
  console.log(`  Unique states: ${allGroups.length}`);
  console.log(`  States with equivalent chains: ${equivalentGroups.length}\n`);

  // writeSummary(totalChains, allGroups, equivalentGroups);
  // writeFullData(allGroups);
  // console.log('');
}

// Run directly: npx tsx src/perfect-start-solver/explore-landscape/questions/q2-equivalent-burst-chains-simple.ts
const isMain = process.argv[1]?.endsWith('q2-equivalent-burst-chains-simple.ts');
if (isMain) run();

export type { BurstSizeChain, CorridorState };
export { exploreEquivalentBurstChains, corridorBurst, run };
