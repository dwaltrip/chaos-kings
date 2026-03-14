import type { TestBoard } from '../test-boards';
import type { Move } from '../types';

import { solve } from './solver';
import type { PerfStats } from './beam-search';
import type { ScoringFn } from './types';

interface RunConfig {
  board: TestBoard;
  scoringFn: { name: string; fn: ScoringFn };
  beamWidth: number;
  maxTicks: number;
}

interface RunResult {
  boardName: string;
  scoringFnName: string;
  beamWidth: number;
  maxTicks: number;
  finalLand: number;
  landCurve: number[];
  durationMs: number;
  moves: Move[];
  perf: PerfStats;
}

function runComparison(configs: RunConfig[]): RunResult[] {
  const total = configs.length;
  return configs.map((config, i) => {
    console.log(
      `[${i + 1}/${total}] ${config.board.name} | ${config.scoringFn.name} | beam=${config.beamWidth} ...`,
    );

    const result = solve(config.board.board, config.board.generalCoord, {
      beamWidth: config.beamWidth,
      maxTicks: config.maxTicks,
      scoringFn: config.scoringFn.fn,
    });

    console.log(
      `        -> land=${result.finalLand} in ${Math.round(result.perf.totalMs)}ms`,
    );

    return {
      ...result,
      boardName: config.board.name,
      scoringFnName: config.scoringFn.name,
      beamWidth: config.beamWidth,
      maxTicks: config.maxTicks,
      landCurve: result.landCurve,
      durationMs: Math.round(result.perf.totalMs),
    };
  });
}

export type { RunConfig, RunResult };
export { runComparison };
