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

export type { BurstInfo, BurstSpec, TimingState };
export { getBurstInfosFromSpecs, simulateOneBurst };
