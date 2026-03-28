// "Abstract Move" - A move with no geometric constraints.
// I think of it as if we are playing on a board with infinite dimensions.
// So there is always another "free" neighbor next to the general
// that you can move to if you want.

import { invariant } from '@utils/assertions/invariant';
import { numStr, tickForGeneralArmy } from './helpers';
import { MAX_TICK } from './constants';
import { maxSingleBurst } from './max-single-burst';

interface AbstractGameState {
  tick: number;
  generalArmy: number;
}

interface AbstractGameStateWithButsts extends AbstractGameState {
  bursts: number[];
}

interface BurstInfo {
  size: number;
  startTick: number;
  endTick: number;
}

type BurstChain = BurstInfo[];

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
  invariant(generalArmy <= target, 'target is less than general army');
  if (generalArmy === target) {
    return { tick, generalArmy };
  }
  const endTick = tickForGeneralArmy(tick, generalArmy, generalArmy + target);
  return {
    tick: endTick,
    generalArmy: generalArmy + target,
  };
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

function maxBurstBeforeMaxTick({ tick, generalArmy }: AbstractGameState): BurstInfo {
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
  return {
    size: burstSize,
    startTick: currTick,
    endTick: currTick + burstSize,
  };
}

// function iterateAbstractMovePatterns() {
//   const maxBurst = maxSingleBurst();
//   const state: AbstractGameState = {
//     tick: 0,
//     generalArmy: 1,
//     bursts: [],
//   };
//   for (let b1=1; b1 <= maxBurst.size; b1++) {
//     const before = waitForArmy(state, b1+1);
//     const after = doBurst(before);

//     for (let b2=0; b2 <= maxBurst.size; b2++) {

//       for (let b3 = 0; b3 <= maxBurst.size; b3++) {

//         const total = b1 + b2 + b3;
//         const limit = Math.min(total, maxBurst.size);
//         for (let m4 = 0; m4 <= limit; m4++) {

//         }
//       }
//     }
//   }
// }

export type { AbstractGameState, BurstInfo };
export { maxBurstBeforeMaxTick };
