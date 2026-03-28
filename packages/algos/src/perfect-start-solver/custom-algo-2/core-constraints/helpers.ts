import { invariant } from '@utils/assertions/invariant';

function numStr(val: number, pad?: number) {
  return String(val).padStart(pad || 0);
}

function tickForInitialGeneralArmy(target: number): number {
  return tickForGeneralArmy(0, 1, target);
}

function tickForGeneralArmy(currentTick: number, army: number, target: number): number {
  invariant(army <= target, `army (${army}) IS NOT <= target (${target})`);
  if (army === target) {
    return currentTick;
  }
  if (currentTick % 2 !== 0) {
    currentTick += 1;
    army += 1;
  }
  const armyNeeded = target - army;
  return currentTick + armyNeeded * 2;
}

export { numStr, tickForInitialGeneralArmy, tickForGeneralArmy };
