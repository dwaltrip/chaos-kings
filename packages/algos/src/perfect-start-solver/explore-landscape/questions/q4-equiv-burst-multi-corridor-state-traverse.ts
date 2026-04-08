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

// ---- Helpers ---------------------------------------------------------------

function stateKey(s: MultiCorridorState): string {
  return `${s.tick},${s.generalArmy},${s.frontiers.join(',')}`;
}

function applyBurst(
  state: MultiCorridorState,
  dir: number,
  targetArmy: number,
): MultiCorridorState {
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

// ---- State-graph BFS with DAG path counting --------------------------------

function exploreMultiCorridorStates(numCorridors: number, cfg: AlgoConfig) {
  const initialState: MultiCorridorState = {
    tick: 0,
    generalArmy: 1,
    frontiers: new Array(numCorridors).fill(0),
  };

  // Phase 1: Discover all reachable states and collect edges
  const stateMap = new Map<string, MultiCorridorState>();
  const edges: Array<{ fromKey: string; toKey: string }> = [];
  const discoveryQueue: string[] = [];

  const initKey = stateKey(initialState);
  stateMap.set(initKey, initialState);
  discoveryQueue.push(initKey);

  let queueIdx = 0;
  while (queueIdx < discoveryQueue.length) {
    const key = discoveryQueue[queueIdx++];
    const state = stateMap.get(key)!;
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

        const nextState = applyBurst(state, dir, targetArmy);
        const nextKey = stateKey(nextState);

        edges.push({ fromKey: key, toKey: nextKey });

        if (!stateMap.has(nextKey)) {
          stateMap.set(nextKey, nextState);
          discoveryQueue.push(nextKey);
        }
      }
    }
  }

  // Phase 2: Sort states by tick, then propagate path counts
  const sortedKeys = Array.from(stateMap.keys()).sort((a, b) => {
    return stateMap.get(a)!.tick - stateMap.get(b)!.tick;
  });

  const pathCounts = new Map<string, number>();
  for (const key of sortedKeys) {
    pathCounts.set(key, 0);
  }
  pathCounts.set(initKey, 1);

  // Group edges by source for efficient lookup
  const edgesBySource = new Map<string, string[]>();
  for (const { fromKey, toKey } of edges) {
    let targets = edgesBySource.get(fromKey);
    if (!targets) {
      targets = [];
      edgesBySource.set(fromKey, targets);
    }
    targets.push(toKey);
  }

  for (const key of sortedKeys) {
    const myPaths = pathCounts.get(key)!;
    if (myPaths === 0) continue;

    const targets = edgesBySource.get(key);
    if (!targets) continue;

    for (const toKey of targets) {
      pathCounts.set(toKey, pathCounts.get(toKey)! + myPaths);
    }
  }

  // Exclude initial state from results
  pathCounts.delete(initKey);
  stateMap.delete(initKey);

  const uniqueStates = pathCounts.size;
  let totalChains = 0;
  for (const count of pathCounts.values()) {
    totalChains += count;
  }
  const equivalentStates = Array.from(pathCounts.values()).filter((c) => c > 1).length;

  return {
    totalChains,
    uniqueStates,
    equivalentStates,
    totalEdges: edges.length,
    pathCounts,
    stateMap,
  };
}

// ---- CLI + Main ------------------------------------------------------------

interface Q4Options {
  maxTick: string;
  corridors: string;
}

function run(numCorridors: number, cfg: AlgoConfig) {
  const start = performance.now();
  const { totalChains, uniqueStates, totalEdges } = exploreMultiCorridorStates(
    numCorridors,
    cfg,
  );
  const elapsed = ((performance.now() - start) / 1000).toFixed(2);

  console.log(`  ${numCorridors}-corridor | MAX_TICK=${cfg.maxTick} (${elapsed}s)`);
  console.log(`    Total chains:    ${totalChains.toLocaleString()}`);
  console.log(`    Unique states:   ${uniqueStates.toLocaleString()}`);
  console.log(`    Total edges:     ${totalEdges.toLocaleString()}`);
  console.log(`    Reduction ratio: ${(totalChains / uniqueStates).toFixed(1)}x`);
  console.log();
}

const isMain = process.argv[1]?.endsWith(
  'q4-equiv-burst-multi-corridor-state-traverse.ts',
);
if (isMain) {
  const { opts } = parseTypedCommand(
    createTypedCommand<Q4Options>()
      .name('q4-equiv-burst-multi-corridor-state-traverse')
      .description('State-graph BFS for N-corridor burst equivalence')
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

export type { MultiCorridorState };
export { applyBurst, exploreMultiCorridorStates, stateKey };
