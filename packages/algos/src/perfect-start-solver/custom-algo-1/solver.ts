import { type FlatBoard } from '@/core-next/flat-board';

import { type BurstPattern, genValidBurstPatterns } from './burst-patterns';
import { genPathsDP } from './gen-paths';
import { getBurstInfos, type BurstInfo } from './get-burst-info';
import { buildPathEntries, findPaths, type PathEntry } from './path-search';
import { popcount } from './bitmask';

interface Solution {
  pattern: BurstPattern;
  burstInfos: BurstInfo[];
  paths: PathEntry[];
  coveredMask: bigint;
  totalCaptured: number;
}

interface SolverConfig {
  maxTicks: number;
  maxBurst: number;
  // highest capture count to try (works down from here)
  maxCaptures: number;
  // stop trying below this capture count
  minCaptures: number;
}

const DEFAULT_CONFIG: SolverConfig = {
  maxTicks: 50,
  // Path counts grow ~2.5x per length. On open 11x11, length 12 is ~60K
  // paths which is fine; length 14+ OOMs. Cap conservatively for now.
  maxBurst: 12,
  maxCaptures: 24,
  minCaptures: 15,
};

interface SolverResult {
  solution: Solution | null;
  patternsChecked: number;
  elapsedMs: number;
}

function solve(
  board: FlatBoard,
  generalPos: number,
  config: Partial<SolverConfig> = {},
): SolverResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const t0 = performance.now();

  // generate paths once (up to max burst length + 1 for the general tile)
  const pathsByLen = genPathsDP(board, generalPos, cfg.maxBurst + 1);
  const entries = buildPathEntries(pathsByLen);

  let patternsChecked = 0;

  for (let captures = cfg.maxCaptures; captures >= cfg.minCaptures; captures--) {
    const patterns = genValidBurstPatterns(captures, cfg.maxBurst, cfg.maxTicks);

    for (const pattern of patterns) {
      patternsChecked++;
      const result = findPaths(entries, pattern);

      if (result) {
        return {
          solution: {
            pattern,
            burstInfos: getBurstInfos(pattern),
            paths: result.paths,
            coveredMask: result.coveredMask,
            totalCaptured: popcount(result.coveredMask),
          },
          patternsChecked,
          elapsedMs: performance.now() - t0,
        };
      }
    }
  }

  return {
    solution: null,
    patternsChecked,
    elapsedMs: performance.now() - t0,
  };
}

export type { Solution, SolverConfig, SolverResult };
export { solve };
