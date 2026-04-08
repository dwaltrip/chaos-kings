/*
  Equivalent Burst Chains — N-Corridor (Generalized)

  Model:
  - General at center, N corridors radiating outward
  - Each burst chooses a direction (0..N-1) and waits for targetArmy
  - Re-traversal cost = that direction's frontier
  - Burst size = targetArmy - 1
  - Total moves per burst = frontier + burstSize
  - After burst: generalArmy = 1 + production ticks during burst

  State = (tick, generalArmy, frontiers[0..N-1])
  Two chains are equivalent if they produce the same state.
*/

import { invariant } from '@utils/assertions/invariant';
import { createTypedCommand, parseTypedCommand } from '@utils/typed-command';

import type { AlgoConfig } from '../abstract-moves';
import { countProductionTicks } from '../abstract-moves';
import { tickForGeneralArmy } from '../helpers';
import { MAX_TICK } from '../constants';

// ---- Types -----------------------------------------------------------------

interface MultiCorridorState {
  tick: number;
  generalArmy: number;
  frontiers: number[];
}

type BurstStep = { dir: number; size: number };
type BurstChain = BurstStep[];

// ---- Core logic ------------------------------------------------------------

function corridorBurstMulti(
  state: MultiCorridorState,
  dir: number,
  targetArmy: number,
): MultiCorridorState {
  invariant(
    targetArmy >= state.generalArmy,
    `targetArmy (${targetArmy}) must be >= generalArmy (${state.generalArmy})`,
  );
  invariant(targetArmy >= 2, `targetArmy (${targetArmy}) must be >= 2`);
  invariant(
    dir >= 0 && dir < state.frontiers.length,
    `dir (${dir}) out of range [0, ${state.frontiers.length})`,
  );

  const burstSize = targetArmy - 1;
  const frontier = state.frontiers[dir];

  let readyTick = state.tick;
  if (state.generalArmy < targetArmy) {
    readyTick = tickForGeneralArmy(state.tick, state.generalArmy, targetArmy);
  }

  const totalMoves = frontier + burstSize;
  const firstMoveTick = readyTick + 1;
  const endTick = firstMoveTick + totalMoves - 1;
  const newUnits = countProductionTicks(firstMoveTick, endTick);

  const newFrontiers = [...state.frontiers];
  newFrontiers[dir] += burstSize;

  return {
    tick: endTick,
    generalArmy: 1 + newUnits,
    frontiers: newFrontiers,
  };
}

// ---- Enumeration -----------------------------------------------------------

function stateKey(s: MultiCorridorState): string {
  return `${s.tick},${s.generalArmy},${s.frontiers.join(',')}`;
}

function exploreMultiCorridor(numCorridors: number, cfg: AlgoConfig) {
  const classesByKey = new Map<string, BurstChain[]>();

  function recurse(state: MultiCorridorState, chain: BurstStep[]): void {
    if (chain.length > 0) {
      const key = stateKey(state);
      let group = classesByKey.get(key);
      if (!group) {
        group = [];
        classesByKey.set(key, group);
      }
      group.push([...chain]);
    }

    const minTargetArmy = Math.max(2, state.generalArmy);

    for (let dir = 0; dir < numCorridors; dir++) {
      const frontier = state.frontiers[dir];

      for (let targetArmy = minTargetArmy; targetArmy <= cfg.maxTick; targetArmy++) {
        const burstSize = targetArmy - 1;

        let readyTick = state.tick;
        if (state.generalArmy < targetArmy) {
          readyTick = tickForGeneralArmy(state.tick, state.generalArmy, targetArmy);
        }
        const totalMoves = frontier + burstSize;
        const endTick = readyTick + 1 + totalMoves - 1;

        if (endTick > cfg.maxTick) break;

        const nextState = corridorBurstMulti(state, dir, targetArmy);
        chain.push({ dir, size: burstSize });
        recurse(nextState, chain);
        chain.pop();
      }
    }
  }

  const initialState: MultiCorridorState = {
    tick: 0,
    generalArmy: 1,
    frontiers: new Array(numCorridors).fill(0),
  };
  recurse(initialState, []);

  const totalChains = Array.from(classesByKey.values()).reduce(
    (sum, chains) => sum + chains.length,
    0,
  );

  return { totalChains, uniqueStates: classesByKey.size, classesByKey };
}

// ---- CLI + Main ------------------------------------------------------------

interface Q4Options {
  maxTick: string;
  corridors: string;
}

function run(numCorridors: number, cfg: AlgoConfig) {
  const { totalChains, uniqueStates } = exploreMultiCorridor(numCorridors, cfg);

  console.log(`  ${numCorridors}-corridor | MAX_TICK=${cfg.maxTick}`);
  console.log(`    Total chains:    ${totalChains.toLocaleString()}`);
  console.log(`    Unique states:   ${uniqueStates.toLocaleString()}`);
  console.log(`    Reduction ratio: ${(totalChains / uniqueStates).toFixed(1)}x`);
  console.log();
}

const isMain = process.argv[1]?.endsWith('q4-equivalent-burst-chains-multi.ts');
if (isMain) {
  const { opts } = parseTypedCommand(
    createTypedCommand<Q4Options>()
      .name('q4-equivalent-burst-chains-multi')
      .description('Explore equivalent burst chains in an N-corridor star graph')
      .option('--max-tick <n>', 'Maximum tick to explore', String(MAX_TICK))
      .option(
        '--corridors <n>',
        'Comma-separated corridor counts to run (e.g. "2,3,4")',
        '2,3,4',
      ),
  );

  const cfg: AlgoConfig = { maxTick: Number(opts.maxTick) };
  const counts = opts.corridors.split(',').map(Number);

  console.log();
  for (const c of counts) {
    run(c, cfg);
  }
}

export type { MultiCorridorState, BurstStep, BurstChain };
export { corridorBurstMulti, exploreMultiCorridor, stateKey };
