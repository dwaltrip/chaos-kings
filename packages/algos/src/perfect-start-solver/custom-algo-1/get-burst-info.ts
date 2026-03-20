// ── Types ──

type BurstSpec = { moves: number; captures: number };

interface TimingState {
  tick: number;
  generalTroops: number;
}

type BurstInfo = { burstLen: number; startTick: number; endTick: number };

// ── Core logic ──

// Simulates one burst from the given timing state.
// Returns endTick and state after burst, or null if exceeds maxTicks.
function simulateOneBurst(
  captures: number,
  moves: number,
  state: TimingState,
  maxTicks: number,
): { endTick: number; nextState: TimingState } | null {
  let { tick, generalTroops } = state;
  let movesRemaining = moves;

  while (movesRemaining > 0) {
    if (tick > maxTicks) return null;

    if (movesRemaining === moves) {
      // waiting to depart — need enough troops for captures
      const troopsNeeded = captures + 1;
      if (generalTroops >= troopsNeeded) {
        generalTroops = 1;
        movesRemaining--;
      }
    } else {
      movesRemaining--;
    }

    if (tick % 2 === 0) {
      generalTroops++;
    }

    tick++;
  }

  return { endTick: tick - 1, nextState: { tick, generalTroops } };
}

function getBurstInfosFromSpecs(
  specs: BurstSpec[],
  maxTicks: number,
): BurstInfo[] | null {
  let state: TimingState = { tick: 1, generalTroops: 1 };
  const infos: BurstInfo[] = [];

  for (const spec of specs) {
    const result = simulateOneBurst(spec.captures, spec.moves, state, maxTicks);
    if (!result) return null;
    infos.push({
      burstLen: spec.moves,
      startTick: result.endTick - spec.moves + 1,
      endTick: result.endTick,
    });
    state = result.nextState;
  }

  return infos;
}

// ── Legacy functions (used by existing callers, removed in Block 4) ──

function getMoveTicksForBurstPattern(pattern: number[]): number[] {
  const moveTicks: number[] = [];
  let generalTroops = 1;
  let burstIdx = 0;
  let burstMovesRemaining = 0;

  for (let t = 1; burstIdx < pattern.length; t++) {
    if (burstMovesRemaining > 0) {
      moveTicks.push(t);
      burstMovesRemaining--;
      if (burstMovesRemaining === 0) burstIdx++;
    } else {
      const troopsNeeded = pattern[burstIdx] + 1;
      if (generalTroops >= troopsNeeded) {
        generalTroops = 1;
        moveTicks.push(t);
        burstMovesRemaining = pattern[burstIdx] - 1;
        if (burstMovesRemaining === 0) burstIdx++;
      }
    }

    if (t % 2 === 0) {
      generalTroops++;
    }
  }

  return moveTicks;
}

function getBurstInfos(pattern: number[]): BurstInfo[] {
  const ticks = getMoveTicksForBurstPattern(pattern);
  const bursts: BurstInfo[] = [];
  let tickIdx = 0;
  for (const burstLen of pattern) {
    const startTick = ticks[tickIdx];
    const endTick = ticks[tickIdx + burstLen - 1];
    bursts.push({ burstLen, startTick, endTick });
    tickIdx += burstLen;
  }
  return bursts;
}

export type { BurstInfo, BurstSpec, TimingState };
export {
  getBurstInfos,
  getBurstInfosFromSpecs,
  getMoveTicksForBurstPattern,
  simulateOneBurst,
};
