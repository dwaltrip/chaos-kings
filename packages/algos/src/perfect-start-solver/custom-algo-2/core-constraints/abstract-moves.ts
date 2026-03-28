// "Abstract Move" - A move with no geometric constraints.
// I think of it as if we are playing on a board with infinite dimensions.
// So there is always another "free" neighbor next to the general
// that you can move to if you want.

import { invariant } from '@utils/assertions/invariant';
import { tickForGeneralArmy } from './helpers';
import { MAX_TICK } from './constants';
import { maxSingleBurst } from './max-single-burst';

interface BurstInfo {
  size: number;
  startTick: number;
  endTick: number;
}

type ReadOnlyBurstInfo = Readonly<BurstInfo>;

const NULL_BURST_INFO: ReadOnlyBurstInfo = { size: 0, startTick: -1, endTick: -1 };

type BurstChain = BurstInfo[];

interface AbstractGameState {
  tick: number;
  generalArmy: number;
}

interface AbstractBursts {
  state: AbstractGameState;
  bursts: BurstChain;
}

function makeBurst(startTick: number, size: number): BurstInfo {
  return { startTick, size, endTick: startTick + size };
}

// start tick to end tick
function countProductionTicks(start: number, end: number): number {
  const diff = end - start;
  return start % 2 === 0 ? Math.floor(diff / 2) : Math.ceil(diff / 2);
}

function doBurst({ tick, generalArmy }: AbstractGameState): AbstractGameState {
  const burst = generalArmy - 1;
  const prodTicks = countProductionTicks(tick, tick + burst);
  return { tick: tick + burst, generalArmy: 1 + prodTicks };
}

function waitForArmy(
  { tick, generalArmy }: AbstractGameState,
  target: number,
): AbstractGameState {
  if (generalArmy === target) {
    return { tick, generalArmy };
  }
  const endTick = tickForGeneralArmy(tick, generalArmy, target);
  return { tick: endTick, generalArmy: target };
}

function calcSpareTicks(tick: number, army: number) {
  const excessArmy = army - 1;
  const ticksRemaining = MAX_TICK - tick;
  return ticksRemaining - excessArmy;
}

function shouldStartMaxBurst(tick: number, army: number): boolean {
  const isProdTick = tick % 2 === 0;
  const spareTicks = calcSpareTicks(tick, army);
  return spareTicks <= 1 || (spareTicks == 2 && isProdTick);
}

function maxBurstBeforeMaxTick({
  tick,
  generalArmy,
}: AbstractGameState): ReadOnlyBurstInfo {
  let currTick = tick;
  let currArmy = generalArmy;

  while (currTick < MAX_TICK && !shouldStartMaxBurst(currTick, currArmy)) {
    currTick++;

    // don't produce on the "starting tick"
    const isProdTick = currTick % 2 === 0;
    if (isProdTick && currTick !== tick) {
      currArmy++;
    }
  }

  const burstSize = currArmy - 1;
  if (burstSize > 0) {
    return {
      size: burstSize,
      startTick: currTick,
      endTick: currTick + burstSize,
    };
  } else {
    return NULL_BURST_INFO;
  }
}

/*
function iterateAbstractMovePatterns() {
  const maxBurst = maxSingleBurst();
  const state: AbstractGameState = { tick: 0, generalArmy: 1 };
  for (let b1=1; b1 <= maxBurst.size; b1++) {

    const afterBurst = doBurst(waitForArmy(state, b1+1))
    const b2Max = maxBurstBeforeMaxTick(afterBurst).size;
    for (let b2=0; b2<=b2Max; b2++) {

    }
  }
}
*/

function countAbstractMovePatterns(): number {
  const start: AbstractBursts = {
    state: { tick: 0, generalArmy: 1 },
    bursts: [],
  };

  function recurse(ab: AbstractBursts): number {
    if (ab.state.tick > MAX_TICK) {
      return 0;
    }
    const { state, bursts } = ab;
    const maxBurst = maxBurstBeforeMaxTick(state);

    // TODO: is this the correct base case?
    if (maxBurst.size === 0) {
      return 1;
    }

    let count = 0;
    let nextBurst: BurstInfo;
    let nextBursts: BurstChain;
    let nextState: AbstractGameState;

    for (let size = 1; size <= maxBurst.size; size++) {
      nextBurst = makeBurst(state.tick, size);
      nextBursts = bursts.concat(nextBurst);
      nextState = doBurst(waitForArmy(state, size + 1));
      count += recurse({ state: nextState, bursts: nextBursts });
    }
    return count;
  }

  return recurse(start);
}

export type { AbstractGameState, BurstInfo };
export {
  NULL_BURST_INFO,
  maxBurstBeforeMaxTick,
  waitForArmy,
  doBurst,
  countAbstractMovePatterns,
};
