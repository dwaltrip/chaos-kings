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

import { countProductionTicks } from '../abstract-moves';
import { tickForGeneralArmy } from '../helpers';
import { MAX_TICK } from '../constants';
import { alignColumns } from '@/utils/format';

interface CorridorState {
  tick: number;
  generalArmy: number;
  frontier: number;
}

type BurstSizeChain = number[];

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

  const equivalentGroups: { state: CorridorState; chains: BurstSizeChain[] }[] = [];
  for (const [key, chains] of classesByKey) {
    if (chains.length > 1) {
      const [tick, generalArmy, frontier] = key.split(',').map(Number);
      equivalentGroups.push({ state: { tick, generalArmy, frontier }, chains });
    }
  }

  equivalentGroups.sort(
    (a, b) => a.state.frontier - b.state.frontier || a.state.tick - b.state.tick,
  );

  const totalChains = [...classesByKey.values()].reduce((sum, c) => sum + c.length, 0);
  console.log(`\n  Total chains: ${totalChains}`);
  console.log(`  Unique end states: ${classesByKey.size}`);
  console.log(`  States with equivalent chains: ${equivalentGroups.length}\n`);

  for (const { state, chains } of equivalentGroups) {
    const { tick, generalArmy, frontier } = state;
    console.log(
      `  frontier=${frontier}  tick=${tick}  army=${generalArmy}  (${chains.length} chains)`,
    );
    const rows = chains.map((c) => [`    [${c.join(', ')}]`]);
    console.log(alignColumns(rows).join('\n'));
  }
  console.log('');

  return {
    totalChains,
    uniqueEndStates: classesByKey.size,
    equivalentGroups: equivalentGroups.length,
  };
}

export { exploreEquivalentBurstChains };
