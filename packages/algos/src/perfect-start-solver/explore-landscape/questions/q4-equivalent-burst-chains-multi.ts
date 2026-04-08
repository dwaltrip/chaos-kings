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

// ---- Enumeration -----------------------------------------------------------

function stateKey(s: MultiCorridorState): string {
  return `${s.tick},${s.generalArmy},${s.frontiers.join(',')}`;
}

function exploreMultiCorridor(numCorridors: number, cfg: AlgoConfig) {
  const countsByKey = new Map<string, number>();
  let totalChains = 0;

  // Single mutable state object — mutate-and-restore to avoid allocations
  const state: MultiCorridorState = {
    tick: 0,
    generalArmy: 1,
    frontiers: new Array(numCorridors).fill(0),
  };

  function recurse(depth: number): void {
    if (depth > 0) {
      const key = stateKey(state);
      countsByKey.set(key, (countsByKey.get(key) || 0) + 1);
      totalChains++;
    }

    const savedTick = state.tick;
    const savedArmy = state.generalArmy;
    const minTargetArmy = Math.max(2, savedArmy);

    for (let dir = 0; dir < numCorridors; dir++) {
      const frontier = state.frontiers[dir];

      for (let targetArmy = minTargetArmy; targetArmy <= cfg.maxTick; targetArmy++) {
        const burstSize = targetArmy - 1;

        let readyTick = savedTick;
        if (savedArmy < targetArmy) {
          readyTick = tickForGeneralArmy(savedTick, savedArmy, targetArmy);
        }
        const totalMoves = frontier + burstSize;
        const firstMoveTick = readyTick + 1;
        const endTick = firstMoveTick + totalMoves - 1;

        if (endTick > cfg.maxTick) break;

        const newUnits = countProductionTicks(firstMoveTick, endTick);

        // Mutate
        state.tick = endTick;
        state.generalArmy = 1 + newUnits;
        state.frontiers[dir] += burstSize;

        recurse(depth + 1);

        // Restore
        state.tick = savedTick;
        state.generalArmy = savedArmy;
        state.frontiers[dir] -= burstSize;
      }
    }
  }

  recurse(0);

  const uniqueStates = countsByKey.size;
  const equivalentStates = Array.from(countsByKey.values()).filter((c) => c > 1).length;

  return { totalChains, uniqueStates, equivalentStates, countsByKey };
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
export { exploreMultiCorridor, stateKey };
