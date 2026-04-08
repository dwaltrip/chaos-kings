/*
  Visualize the state DAG iteration for a small example.
  2 corridors, maxTick=10.
*/

import { countProductionTicks } from '../abstract-moves';
import { tickForGeneralArmy } from '../helpers';

interface State {
  tick: number;
  generalArmy: number;
  frontiers: number[];
}

function stateKey(s: State): string {
  return `t=${s.tick} army=${s.generalArmy} f=[${s.frontiers.join(',')}]`;
}

function shortKey(s: State): string {
  return `(${s.tick},${s.generalArmy},[${s.frontiers.join(',')}])`;
}

const NUM_CORRIDORS = 2;
const MAX_TICK = 10;

// ---- Phase 1: Discover all states and edges --------------------------------

console.log('=== Phase 1: Discovery (BFS) ===\n');

interface Edge {
  fromKey: string;
  toKey: string;
  dir: number;
  targetArmy: number;
  burstSize: number;
}

const stateMap = new Map<string, State>();
const edges: Edge[] = [];
const queue: string[] = [];

const initial: State = { tick: 0, generalArmy: 1, frontiers: [0, 0] };
const initKey = stateKey(initial);
stateMap.set(initKey, initial);
queue.push(initKey);

let step = 0;
let queueIdx = 0;

while (queueIdx < queue.length) {
  const key = queue[queueIdx++];
  const state = stateMap.get(key)!;
  step++;

  console.log(`  Step ${step}: process ${shortKey(state)}`);

  const minTargetArmy = Math.max(2, state.generalArmy);

  for (let dir = 0; dir < NUM_CORRIDORS; dir++) {
    const frontier = state.frontiers[dir];

    for (let targetArmy = minTargetArmy; targetArmy <= MAX_TICK; targetArmy++) {
      const burstSize = targetArmy - 1;

      let readyTick = state.tick;
      if (state.generalArmy < targetArmy) {
        readyTick = tickForGeneralArmy(state.tick, state.generalArmy, targetArmy);
      }
      const totalMoves = frontier + burstSize;
      const firstMoveTick = readyTick + 1;
      const endTick = firstMoveTick + totalMoves - 1;

      if (endTick > MAX_TICK) break;

      const newUnits = countProductionTicks(firstMoveTick, endTick);
      const newFrontiers = [...state.frontiers];
      newFrontiers[dir] += burstSize;

      const nextState: State = {
        tick: endTick,
        generalArmy: 1 + newUnits,
        frontiers: newFrontiers,
      };
      const nextKey = stateKey(nextState);

      const isNew = !stateMap.has(nextKey);
      edges.push({ fromKey: key, toKey: nextKey, dir, targetArmy, burstSize });

      if (isNew) {
        stateMap.set(nextKey, nextState);
        queue.push(nextKey);
        console.log(`    → dir=${dir} burst=${burstSize}: ${shortKey(nextState)} [NEW]`);
      } else {
        console.log(`    → dir=${dir} burst=${burstSize}: ${shortKey(nextState)} [seen]`);
      }
    }
  }
}

console.log(`\n  Total: ${stateMap.size} states, ${edges.length} edges\n`);

// ---- Phase 2: Propagate path counts in tick order --------------------------

console.log('=== Phase 2: Path count propagation (tick order) ===\n');

const sortedKeys = Array.from(stateMap.keys()).sort((a, b) => {
  return stateMap.get(a)!.tick - stateMap.get(b)!.tick;
});

const edgesBySource = new Map<string, Edge[]>();
for (const edge of edges) {
  let list = edgesBySource.get(edge.fromKey);
  if (!list) {
    list = [];
    edgesBySource.set(edge.fromKey, list);
  }
  list.push(edge);
}

const pathCounts = new Map<string, number>();
for (const key of sortedKeys) {
  pathCounts.set(key, 0);
}
pathCounts.set(initKey, 1);

for (const key of sortedKeys) {
  const state = stateMap.get(key)!;
  const myPaths = pathCounts.get(key)!;

  if (myPaths === 0) continue;

  const outEdges = edgesBySource.get(key);
  if (!outEdges || outEdges.length === 0) {
    console.log(`  ${shortKey(state)} paths=${myPaths} (leaf)`);
    continue;
  }

  console.log(`  ${shortKey(state)} paths=${myPaths}`);

  for (const edge of outEdges) {
    const target = stateMap.get(edge.toKey)!;
    const oldCount = pathCounts.get(edge.toKey)!;
    const newCount = oldCount + myPaths;
    pathCounts.set(edge.toKey, newCount);
    console.log(
      `    → d${edge.dir} b${edge.burstSize} → ${shortKey(target)}: ${oldCount} + ${myPaths} = ${newCount}`,
    );
  }
}

// ---- Summary ---------------------------------------------------------------

console.log('\n=== Summary ===\n');

pathCounts.delete(initKey);

let totalChains = 0;
for (const [key, count] of pathCounts) {
  const state = stateMap.get(key)!;
  totalChains += count;
  console.log(`  ${shortKey(state)}: ${count} chains`);
}
console.log(`\n  Total chains: ${totalChains}`);
console.log(`  Unique states: ${pathCounts.size}`);

// ---- Brute-force chain enumeration (old way) -------------------------------

console.log('\n\n=== Brute-force chain enumeration ===\n');

type BurstStep = { dir: number; size: number };

const bruteCountsByKey = new Map<string, number>();
let bruteTotal = 0;
let bruteSteps = 0;

function recurse(state: State, chain: BurstStep[], depth: number): void {
  if (depth > 0) {
    const key = stateKey(state);
    bruteCountsByKey.set(key, (bruteCountsByKey.get(key) || 0) + 1);
    bruteTotal++;

    const chainStr = chain.map((s) => `d${s.dir}b${s.size}`).join(' → ');
    console.log(`  chain #${bruteTotal}: ${chainStr} → ${shortKey(state)}`);
  }

  const minTargetArmy = Math.max(2, state.generalArmy);

  for (let dir = 0; dir < NUM_CORRIDORS; dir++) {
    const frontier = state.frontiers[dir];

    for (let targetArmy = minTargetArmy; targetArmy <= MAX_TICK; targetArmy++) {
      const burstSize = targetArmy - 1;

      let readyTick = state.tick;
      if (state.generalArmy < targetArmy) {
        readyTick = tickForGeneralArmy(state.tick, state.generalArmy, targetArmy);
      }
      const totalMoves = frontier + burstSize;
      const firstMoveTick = readyTick + 1;
      const endTick = firstMoveTick + totalMoves - 1;

      if (endTick > MAX_TICK) break;

      const newUnits = countProductionTicks(firstMoveTick, endTick);
      const newFrontiers = [...state.frontiers];
      newFrontiers[dir] += burstSize;

      const nextState: State = {
        tick: endTick,
        generalArmy: 1 + newUnits,
        frontiers: newFrontiers,
      };

      bruteSteps++;
      chain.push({ dir, size: burstSize });
      recurse(nextState, chain, depth + 1);
      chain.pop();
    }
  }
}

recurse(initial, [], 0);

console.log(`\n  Total chains: ${bruteTotal}`);
console.log(`  Unique states: ${bruteCountsByKey.size}`);
console.log(`  Recursive calls (steps): ${bruteSteps}`);
