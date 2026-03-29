// "Abstract Move" - A move with no geometric constraints.
// I think of it as if we are playing on a board with infinite dimensions.
// So there is always another "free" neighbor next to the general
// that you can move to if you want.

import { invariant } from '@utils/assertions/invariant';
import { numStr, tickForGeneralArmy } from './helpers';
import { MAX_TICK } from './constants';
import { maxSingleBurst } from './max-single-burst';

interface BurstInfo {
  size: number;
  firstMoveTick: number;
}

function lastMoveTick(burst: BurstInfo): number {
  return burst.firstMoveTick + burst.size - 1;
}

type ReadOnlyBurstInfo = Readonly<BurstInfo>;

const NULL_BURST_INFO: ReadOnlyBurstInfo = { size: 0, firstMoveTick: -1 };

type BurstChain = BurstInfo[];

interface AbstractGameState {
  tick: number;
  generalArmy: number;
}

interface AbstractBursts {
  state: AbstractGameState;
  bursts: BurstChain;
}

function makeBurst(firstMoveTick: number, size: number): BurstInfo {
  return { firstMoveTick, size };
}

// Count of production ticks in the range: [start, end]
// NOTE: Those are square brackets, not parens. Both `start` and `end` are inclusive!
function countProductionTicks(start: number, end: number): number {
  invariant(start <= end, `start (${start}) must be <= to end (${end})`);
  const diff = end - start;
  if (start % 2 === 0) {
    // No production on tick 0!
    const prodForCurrentTick = start === 0 ? 0 : 1;
    // If `start` is even, then Math.floor(diff) gives:
    // The number of even ticks AFTER `start` (inclusive of `end`)
    return prodForCurrentTick + Math.floor(diff / 2);
  }
  return Math.ceil(diff / 2);
}

function isProdTick(tick: number): boolean {
  return tick % 2 == 0;
}

// Returns `endState` for when burst is complete
// E.g. `endState.tick === lastMoveTick(burst)`
function doBurst({ tick, generalArmy }: AbstractGameState): AbstractGameState {
  const size = generalArmy - 1;
  invariant(size > 0, 'burst size must be larger than 0');
  const newUnits = countProductionTicks(tick + 1, tick + size);
  const endState = { tick: tick + size, generalArmy: 1 + newUnits };
  return endState;
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

function calcSpareTicksIfBurstNow(firstMoveTick: number, army: number) {
  // Need to add 1 to incluede `firstMoveTick` itself
  const ticksRemaining = MAX_TICK - firstMoveTick + 1;
  const excessArmy = army - 1;
  return ticksRemaining - excessArmy;
}

function shouldStartMaxBurst(firstMoveTick: number, army: number): boolean {
  // Returns false if there is a longer "complete" burst
  // you can do by waitint more ticks before starting the burst.
  // Returns true if there is NOT a longer "complete" burst.
  // Bursts that finish after MAX_TICK are not complete bursts.
  const isProducing = isProdTick(firstMoveTick);
  const spareTicks = calcSpareTicksIfBurstNow(firstMoveTick, army);
  if (isProducing) {
    // only go if no spare ticks, otherwise should wait at least 1 tick
    return spareTicks <= 0;
  } else {
    // If `firstMoveTick` is odd, you should not wait unless you have 3+ sapre ticks.
    // spare tick 1 -> used because you aren't moving on the current tick.
    // spare tick 2 -> next tick, you produce, no movement (production is after movement)
    // spare tick 3 -> needed for moving the additional troop you ust produced.
    return spareTicks <= 2;
  }
}

// The `tick` param here is the last tick BEFORE we can make a move.
// The earliest possible `firstMoveTick` returned by `maxBurstBeforeMaxTick` is `tick + 1`.
// `generalArmy` is assumed to be value at the END of `tick` (any production on `tick`
//   is already accounted for).
function maxBurstBeforeMaxTick({
  tick,
  generalArmy,
}: AbstractGameState): ReadOnlyBurstInfo {
  // start on the next tick
  // let currTick = tick + 1;
  let currTick = tick;
  let currArmy = generalArmy;

  // while (currTick <= MAX_TICK && !shouldStartMaxBurst(currTick+1, currArmy)) {
  while (currTick < MAX_TICK && !shouldStartMaxBurst(currTick + 1, currArmy)) {
    currTick++;
    if (isProdTick(currTick)) {
      currArmy++;
    }
  }

  const burstSize = currArmy - 1;
  if (burstSize > 0) {
    const ret: BurstInfo = {
      size: burstSize,
      firstMoveTick: currTick + 1,
    };
    return ret;
  } else {
    return NULL_BURST_INFO;
  }
}

function fmtAbstractBursts(ab: AbstractBursts): string {
  const { state, bursts } = ab;
  return [
    `tick = ${numStr(state.tick, 2)}`,
    `general = ${numStr(state.generalArmy, 2)}`,
    `bursts = ${bursts.map((b) => b.size).join(',') || 'none'}`,
  ].join(' | ');
}

function countAbstractMovePatterns(): number {
  const start: AbstractBursts = {
    state: { tick: 0, generalArmy: 1 },
    bursts: [],
  };

  function recurse(ab: AbstractBursts): number {
    if (ab.state.tick > MAX_TICK) {
      return 0;
    }
    if (ab.state.tick === MAX_TICK) {
      return 1;
    }

    const { state, bursts } = ab;
    if (bursts.length > MAX_TICK) {
      throw new Error('Uhhhh..........');
    }
    const maxBurst = maxBurstBeforeMaxTick(state);

    // TODO: is this the correct base case?
    if (maxBurst.size <= 1) {
      return 1;
    }

    let count = 0;
    let nextBurst: BurstInfo;
    let nextBursts: BurstChain;
    let nextState: AbstractGameState;

    // Iterate over target army, not burst size. Each burst uses the full army
    // (generalArmy - 1 moves), so the target army determines the burst size.
    // When generalArmy >= 2, the first iteration bursts immediately (no waiting).
    const minTargetArmy = Math.max(2, state.generalArmy);
    const maxTargetArmy = maxBurst.size + 1;

    for (let targetArmy = minTargetArmy; targetArmy <= maxTargetArmy; targetArmy++) {
      nextState = waitForArmy(state, targetArmy);
      const burstSize = targetArmy - 1;
      nextBurst = makeBurst(nextState.tick + 1, burstSize);
      nextBursts = bursts.concat(nextBurst);
      nextState = doBurst(nextState);
      count += recurse({ state: nextState, bursts: nextBursts });
    }
    return count;
  }

  return recurse(start);
}

export type { AbstractGameState, BurstInfo };
export {
  NULL_BURST_INFO,
  lastMoveTick,
  maxBurstBeforeMaxTick,
  waitForArmy,
  doBurst,
  shouldStartMaxBurst,
  countAbstractMovePatterns,
  countProductionTicks,
};
