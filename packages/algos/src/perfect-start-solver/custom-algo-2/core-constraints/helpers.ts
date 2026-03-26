import { invariant } from '@utils/assertions/invariant';

function numStr(val: number, pad?: number) {
  return String(val).padStart(pad || 0);
}

function tickForInitialGeneralArmy(targetArmy: number): number {
  return tickForGeneralArmy(0, 1, targetArmy);
}

function tickForGeneralArmy(
  currentTick: number,
  currentArmy: number,
  targetArmy: number,
): number {
  invariant(currentArmy <= targetArmy, 'currentArmy must be LTE to targetArmy');
  if (currentArmy === targetArmy) {
    return currentTick;
  }
  if (currentTick % 2 !== 0) {
    currentTick += 1;
    currentArmy += 1;
  }
  const armyNeeded = targetArmy - currentArmy;
  return currentTick + armyNeeded * 2;
}

export { numStr, tickForInitialGeneralArmy, tickForGeneralArmy };
