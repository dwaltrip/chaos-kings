import { type FlatBoard } from '@core-next/flat-board';

import { buildStartingRegion } from '../starting-region/build';
import {
  buildTimingEntries,
  type TimingTableConfig,
} from '../custom-algo-1/timing-table';

import { computeCustomAnnotations } from './prototyping/annotations';
import { scoreStartingRegion } from './prototyping/tip-scorer';
import { generatePrefixPool } from './prefix-pool';
import { mapBurstsToPaths } from './burst-mapper';
import { buildLanes, type LaneRequest } from './lane-builder';
import { assembleSolution, type Solution } from './assembler';
import type { PathResult } from '../utils/find-path';

// Top-level solver for custom-algo-2.
//
// Pipeline: prefix pool → for each capture target → for each prefix set →
// filter compatible timing entries → map bursts to paths → build lanes →
// assemble solution. First success wins.

interface SolverConfig {
  maxTicks: number;
  maxCaptures: number;
  minCaptures: number;
  // Timing table params.
  maxBurst: number;
  maxBursts: number;
  maxOverlapPerBurst: number;
  // Prefix pool params.
  maxTotalOverlap: number;
  prefixTopK: number;
  burstCounts: number[];
  pathLengths: number[];
}

const DEFAULT_CONFIG: SolverConfig = {
  maxTicks: 50,
  maxCaptures: 24,
  minCaptures: 16,
  maxBurst: 12,
  maxBursts: 6,
  maxOverlapPerBurst: 4,
  maxTotalOverlap: 10,
  prefixTopK: 50,
  burstCounts: [3, 4, 5, 6],
  pathLengths: [1, 2, 3, 4, 5],
};

interface SolveResult {
  solution: Solution | null;
  stats: SolveStats;
}

interface SolveStats {
  prefixSetsGenerated: number;
  timingEntriesTotal: number;
  mappingsAttempted: number;
  laneAttemptsTotal: number;
  elapsedMs: number;
}

function solve(
  board: FlatBoard,
  general: number,
  config: Partial<SolverConfig> = {},
): SolveResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const t0 = Date.now();
  const stats: SolveStats = {
    prefixSetsGenerated: 0,
    timingEntriesTotal: 0,
    mappingsAttempted: 0,
    laneAttemptsTotal: 0,
    elapsedMs: 0,
  };

  // Setup (once per board).
  const region = buildStartingRegion(board, general);
  const annotations = computeCustomAnnotations(region, board);
  const tipScores = scoreStartingRegion(region, annotations);

  const poolResult = generatePrefixPool({
    board,
    general,
    maxTotalOverlap: cfg.maxTotalOverlap,
    topK: cfg.prefixTopK,
    tipScores,
    burstCounts: cfg.burstCounts,
    pathLengths: cfg.pathLengths,
  });
  stats.prefixSetsGenerated = poolResult.sets.length;

  const timingConfig: TimingTableConfig = {
    maxTicks: cfg.maxTicks,
    maxBurst: cfg.maxBurst,
    maxBursts: cfg.maxBursts,
    maxOverlapPerBurst: cfg.maxOverlapPerBurst,
  };

  const generalBit = 1n << BigInt(general);

  for (let target = cfg.maxCaptures; target >= cfg.minCaptures; target--) {
    const timingEntries = buildTimingEntries(target, timingConfig);
    stats.timingEntriesTotal += timingEntries.length;

    for (const prefixSet of poolResult.sets) {
      const prefixK = prefixSet.prefixes.length;

      // Filter timing entries by compatibility.
      const compatible = timingEntries.filter((e) => {
        if (e.captures.length !== prefixK) return false;
        let totalOverlap = 0;
        for (const o of e.overlaps) totalOverlap += o;
        return totalOverlap === prefixSet.overlap;
      });

      for (const entry of compatible) {
        const assignments = mapBurstsToPaths(prefixSet, entry);
        stats.mappingsAttempted += assignments.length;

        for (const assignment of assignments) {
          // Extract lane requests for mid-region bursts.
          const laneRequests: LaneRequest[] = [];
          const laneIndexMap: number[] = [];
          for (let i = 0; i < assignment.length; i++) {
            if (assignment[i].laneLength > 0) {
              laneRequests.push({
                tip: assignment[i].prefixPath.tip,
                length: assignment[i].laneLength,
              });
              laneIndexMap.push(i);
            }
          }

          const obstacleMask = prefixSet.unionMask | generalBit;
          stats.laneAttemptsTotal++;

          const laneResult = buildLanes(board, laneRequests, obstacleMask);
          if (!laneResult) continue;

          // Map lanes back to burst indices.
          const lanesById = new Map<number, PathResult>();
          for (let li = 0; li < laneIndexMap.length; li++) {
            lanesById.set(laneIndexMap[li], laneResult.lanes[li]);
          }

          const solution = assembleSolution(assignment, lanesById, entry, cfg.maxTicks);

          if (solution) {
            stats.elapsedMs = Date.now() - t0;
            return { solution, stats };
          }
        }
      }
    }
  }

  stats.elapsedMs = Date.now() - t0;
  return { solution: null, stats };
}

export type { SolverConfig, SolveResult, SolveStats };
export { DEFAULT_CONFIG, solve };
