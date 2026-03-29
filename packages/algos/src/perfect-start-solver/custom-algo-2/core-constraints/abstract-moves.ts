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

// This returns the `state` at the END of the burst
// `returnValue.tick` = the tick of of the last move
function doBurst({ tick, generalArmy }: AbstractGameState): AbstractGameState {
  const burst = generalArmy - 1;
  invariant(burst > 0, 'burst size must be larger than 0');
  const prodTicks = countProductionTicks(tick + 1, tick + burst);
  const res = { tick: tick + burst, generalArmy: 1 + prodTicks };
  console.log(
    `  [do-burst] t0=${tick} -> t1=${res.tick} | g0=${generalArmy} - g1=${res.generalArmy}`,
  );
  return res;
}

function waitForArmy(
  { tick, generalArmy }: AbstractGameState,
  target: number,
): AbstractGameState {
  console.log(`  [waitForArmy] tick=${tick}, gen=${generalArmy}, target=${target}`);
  if (generalArmy === target) {
    return { tick, generalArmy };
  }
  const endTick = tickForGeneralArmy(tick, generalArmy, target);
  return { tick: endTick, generalArmy: target };
}

function calcSpareTicks(possibleMoveTick: number, army: number) {
  const excessArmy = army - 1;
  // we add 1, because we are considering moves ON `possibleMoveTick`
  const ticksRemaining = MAX_TICK - possibleMoveTick + 1;
  return ticksRemaining - excessArmy;
}

function shouldStartMaxBurst(possibleMoveTick: number, army: number): boolean {
  // possibleMoveTick
  const isProducing = isProdTick(possibleMoveTick);
  const spareTicks = calcSpareTicks(possibleMoveTick, army);
  console.log(
    `  [shouldStartMaxBurst(${possibleMoveTick}, ${army})]`,
    `spareTicks: ${spareTicks} | isProducing: ${isProducing}`,
  );
  return spareTicks <= 1;
}

// The `tick` param here is the last tick BEFORE we can make a move.
// The earliest possible `firstMoveTick` returned by `maxBurstBeforeMaxTick` is `tick + 1`.
// `generalArmy` is assumed to be value at the END of `tick` (any production on `tick`
//   is already accounted for).
function maxBurstBeforeMaxTick({
  tick,
  generalArmy,
}: AbstractGameState): ReadOnlyBurstInfo {
  console.group(`--- maxBurstBeforeMaxTick --- tick=${tick}, gen=${generalArmy}`);
  // start on the next tick
  // let currTick = tick + 1;
  let currTick = tick;
  let currArmy = generalArmy;

  console.log('currTick:', currTick, '| currArmy:', currArmy, '(*)');
  // while (currTick <= MAX_TICK && !shouldStartMaxBurst(currTick+1, currArmy)) {
  while (currTick < MAX_TICK && !shouldStartMaxBurst(currTick + 1, currArmy)) {
    currTick++;
    if (isProdTick(currTick)) {
      currArmy++;
    }
    console.log('currTick:', currTick, '| currArmy:', currArmy);
  }

  const burstSize = currArmy - 1;
  if (burstSize > 0) {
    const ret: BurstInfo = {
      size: burstSize,
      firstMoveTick: currTick + 1,
    };
    console.log(
      '[done] size:',
      ret.size,
      '| firstMoveTick:',
      ret.firstMoveTick,
      '| lastMoveTick:',
      lastMoveTick(ret),
    );
    console.groupEnd();
    return ret;
  } else {
    console.log('[done] null');
    console.groupEnd();
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

function fmtAbstractBursts(ab: AbstractBursts): string {
  const { state, bursts } = ab;
  return [
    `tick = ${numStr(state.tick, 2)}`,
    `general = ${numStr(state.generalArmy, 2)}`,
    `bursts = ${bursts.map((b) => b.size).join(',')}`,
  ].join(' | ');
}

function countAbstractMovePatterns(): number {
  const start: AbstractBursts = {
    state: { tick: 0, generalArmy: 1 },
    bursts: [],
  };

  function recurse(ab: AbstractBursts): number {
    console.log(fmtAbstractBursts(ab));
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
      console.log(`  maxBurst (${maxBurst.size}) <= 1 (base case)`);
      return 1;
    }
    console.log(`  maxBurst.size = ${maxBurst.size}`);

    let count = 0;
    let nextBurst: BurstInfo;
    let nextBursts: BurstChain;
    let nextState: AbstractGameState;

    for (let size = 1; size <= maxBurst.size; size++) {
      nextBurst = makeBurst(state.tick, size);
      nextBursts = bursts.concat(nextBurst);
      nextState = state;
      if (nextBurst.firstMoveTick > state.tick) {
        nextState = waitForArmy(nextState, size + 1);
      }
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
