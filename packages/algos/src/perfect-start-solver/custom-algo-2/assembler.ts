import type { PathResult } from '../utils/find-path';

import {
  getBurstInfosFromSpecs,
  type BurstSpec,
  type BurstInfo,
} from '../custom-algo-1/get-burst-info';
import type { TimingEntry } from '../custom-algo-1/timing-table';

import type { BurstAssignment } from './burst-mapper';

// Stitches prefix paths + lanes into a full solution and validates timing.

interface SolvedBurst {
  // Full path: prefix tiles + lane tiles (general excluded).
  path: number[];
  captures: number;
  overlap: number;
  startTick: number;
  endTick: number;
}

interface Solution {
  captures: number;
  bursts: SolvedBurst[];
  burstSpecs: BurstSpec[];
  burstInfos: BurstInfo[];
  endTick: number;
}

function assembleSolution(
  assignments: BurstAssignment[],
  lanes: Map<number, PathResult>,
  timingEntry: TimingEntry,
  maxTicks: number,
): Solution | null {
  const K = assignments.length;

  // Build burst specs for timing simulation.
  const burstSpecs: BurstSpec[] = [];
  for (let i = 0; i < K; i++) {
    const a = assignments[i];
    const captures = timingEntry.captures[i];
    const overlap = timingEntry.overlaps[i];
    burstSpecs.push({ captures, moves: captures + overlap });
  }

  // Validate timing.
  const burstInfos = getBurstInfosFromSpecs(burstSpecs, maxTicks);
  if (!burstInfos) return null;

  // Stitch paths.
  const bursts: SolvedBurst[] = [];
  const seenTiles = new Set<number>();
  let totalCaptures = 0;

  for (let i = 0; i < K; i++) {
    const a = assignments[i];
    const info = burstInfos[i];

    // Build full path: prefix tiles + lane tiles.
    const fullPath = [...a.prefixPath.tiles];
    const lane = lanes.get(i);
    if (a.laneLength > 0) {
      if (!lane) return null;
      fullPath.push(...lane.tiles);
    }

    // Count actual new captures (tiles not seen before).
    let newCaptures = 0;
    for (const t of fullPath) {
      if (!seenTiles.has(t)) {
        newCaptures++;
        seenTiles.add(t);
      }
    }

    // Sanity check: new captures should match timing entry.
    if (newCaptures !== timingEntry.captures[i]) return null;

    bursts.push({
      path: fullPath,
      captures: timingEntry.captures[i],
      overlap: timingEntry.overlaps[i],
      startTick: info.startTick,
      endTick: info.endTick,
    });
    totalCaptures += newCaptures;
  }

  // Sanity check total.
  const expectedTotal = timingEntry.captures.reduce((a, b) => a + b, 0);
  if (totalCaptures !== expectedTotal) return null;

  const endTick = burstInfos[burstInfos.length - 1].endTick;
  if (endTick > maxTicks) return null;

  return {
    captures: totalCaptures,
    bursts,
    burstSpecs,
    burstInfos,
    endTick,
  };
}

export type { Solution, SolvedBurst };
export { assembleSolution };
