import type {
  AbstractGameState,
  AlgoConfig,
  BurstInfo,
  BurstChain,
} from './abstract-moves';
import {
  DEFAULT_CONFIG,
  maxBurstBeforeMaxTick,
  waitForArmy,
  doBurst,
  makeBurst,
} from './abstract-moves';

function getAllAbstractMovePatterns(cfg: AlgoConfig = DEFAULT_CONFIG): BurstChain[] {
  const allPatterns: BurstChain[] = [];
  const current: BurstInfo[] = [];

  function recurse(state: AbstractGameState): void {
    if (state.tick > cfg.maxTick) {
      return;
    }
    if (state.tick === cfg.maxTick) {
      allPatterns.push([...current]);
      return;
    }

    const maxBurst = maxBurstBeforeMaxTick(state, cfg);
    if (maxBurst.size === 0) {
      allPatterns.push([...current]);
      return;
    }

    // Need at least 2 army to make a move
    const minTargetArmy = Math.max(2, state.generalArmy);
    const maxTargetArmy = maxBurst.size + 1;

    // Iterate over target army. Each burst uses the full army (generalArmy - 1 moves),
    // so the target army determines the burst size.
    // When generalArmy >= 2, the first iteration bursts immediately (no waiting).
    for (let targetArmy = minTargetArmy; targetArmy <= maxTargetArmy; targetArmy++) {
      const nextState = waitForArmy(state, targetArmy);
      const burstSize = targetArmy - 1;
      current.push(makeBurst(nextState.tick + 1, burstSize));
      recurse(doBurst(nextState));
      current.pop();
    }
  }

  recurse({ tick: 0, generalArmy: 1 });
  return allPatterns;
}

export { getAllAbstractMovePatterns };
