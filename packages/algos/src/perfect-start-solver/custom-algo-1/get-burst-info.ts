// ── Core logic ──

function getMoveTicksForBurstPattern(pattern: number[]): number[] {
  const moveTicks: number[] = [];
  let generalTroops = 1;
  let burstIdx = 0;
  let burstMovesRemaining = 0;

  for (let t = 1; burstIdx < pattern.length; t++) {
    // ── Phase 1: Movement (before production) ──
    if (burstMovesRemaining > 0) {
      // Mid-burst: keep moving
      moveTicks.push(t);
      burstMovesRemaining--;
      if (burstMovesRemaining === 0) burstIdx++;
    } else {
      // Waiting: can we start the next burst?
      const troopsNeeded = pattern[burstIdx] + 1;
      if (generalTroops >= troopsNeeded) {
        generalTroops = 1; // leave 1 on general, rest marches out
        moveTicks.push(t);
        burstMovesRemaining = pattern[burstIdx] - 1;
        if (burstMovesRemaining === 0) burstIdx++;
      }
    }

    // ── Phase 2: Production (always happens on even ticks) ──
    if (t % 2 === 0) {
      generalTroops++;
    }
  }

  return moveTicks;
}

type BurstInfo = { burstLen: number; startTick: number; endTick: number };

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

export type { BurstInfo };
export { getBurstInfos, getMoveTicksForBurstPattern };
