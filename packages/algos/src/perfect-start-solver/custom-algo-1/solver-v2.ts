import { type FlatBoard } from '@/core-next/flat-board';

import { popcount } from './bitmask';
import { genPathsDP } from './gen-paths';
import { getBurstInfosFromSpecs, type BurstInfo, type BurstSpec } from './get-burst-info';
import {
  buildPathEntries,
  countPrefixOverlap,
  type PathEntry,
  type PathEntriesByLen,
} from './path-search';
import {
  buildTimingEntries,
  type TimingEntry,
  type TimingTableConfig,
} from './timing-table';

interface Solution {
  pattern: number[];
  burstSpecs: BurstSpec[];
  burstInfos: BurstInfo[];
  paths: PathEntry[];
  coveredMask: bigint;
  totalCaptured: number;
}

interface SolverConfig {
  maxTicks: number;
  maxBurst: number;
  maxBursts: number;
  maxCaptures: number;
  minCaptures: number;
  maxOverlapPerBurst: number;
}

const DEFAULT_CONFIG: SolverConfig = {
  maxTicks: 50,
  maxBurst: 12,
  maxBursts: 6,
  maxCaptures: 24,
  minCaptures: 15,
  maxOverlapPerBurst: 3,
};

interface SolverResult {
  solution: Solution | null;
  entriesChecked: number;
  elapsedMs: number;
}

function solveV2(
  board: FlatBoard,
  generalPos: number,
  config: Partial<SolverConfig> = {},
): SolverResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const t0 = performance.now();

  const pathsByLen = genPathsDP(board, generalPos, cfg.maxBurst + 1);
  const entriesByLen = buildPathEntries(pathsByLen);

  const timingConfig: TimingTableConfig = {
    maxTicks: cfg.maxTicks,
    maxBurst: cfg.maxBurst,
    maxBursts: cfg.maxBursts,
    maxOverlapPerBurst: cfg.maxOverlapPerBurst,
  };

  let entriesChecked = 0;

  for (let captures = cfg.maxCaptures; captures >= cfg.minCaptures; captures--) {
    const timingEntries = buildTimingEntries(captures, timingConfig);

    for (const entry of timingEntries) {
      const moves = entry.captures.map((c, i) => c + entry.overlaps[i]);
      if (moves.some((m) => !entriesByLen.has(m))) continue;
      entriesChecked++;

      const paths = findPathsFixed(entriesByLen, entry, moves);
      if (paths) {
        const burstSpecs: BurstSpec[] = entry.captures.map((c, i) => ({
          captures: c,
          moves: moves[i],
        }));

        let coveredMask = 0n;
        for (const p of paths) coveredMask |= p.mask;

        return {
          solution: {
            pattern: entry.captures,
            burstSpecs,
            burstInfos: getBurstInfosFromSpecs(burstSpecs, cfg.maxTicks)!,
            paths,
            coveredMask,
            totalCaptured: popcount(coveredMask),
          },
          entriesChecked,
          elapsedMs: performance.now() - t0,
        };
      }
    }
  }

  return {
    solution: null,
    entriesChecked,
    elapsedMs: performance.now() - t0,
  };
}

// Spatial search with fixed move lengths and overlap counts per burst.
// No timing computation — that's all resolved by the TimingEntry.
function findPathsFixed(
  entriesByLen: PathEntriesByLen,
  entry: TimingEntry,
  moves: number[],
): PathEntry[] | null {
  const numBursts = moves.length;

  function search(burstIdx: number, coveredMask: bigint): PathEntry[] | null {
    if (burstIdx === numBursts) return [];

    const moveLen = moves[burstIdx];
    const overlap = entry.overlaps[burstIdx];
    const candidates = entriesByLen.get(moveLen);
    if (!candidates) return null;

    for (const cand of candidates) {
      if (overlap === 0) {
        if ((cand.mask & coveredMask) !== 0n) continue;
      } else {
        if (popcount(cand.mask & coveredMask) !== overlap) continue;
        if (countPrefixOverlap(cand.tiles, coveredMask) !== overlap) continue;
      }

      const newTiles = overlap > 0 ? cand.mask & ~coveredMask : cand.mask;
      const rest = search(burstIdx + 1, coveredMask | newTiles);
      if (rest) {
        rest.unshift(cand);
        return rest;
      }
    }

    return null;
  }

  return search(0, 0n);
}

export type { Solution, SolverConfig, SolverResult };
export { solveV2 };
