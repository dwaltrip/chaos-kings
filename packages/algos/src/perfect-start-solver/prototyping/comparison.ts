import type { BoardState, Coord } from '@core/types';

import { solve } from './solver';
import type { PerfStats } from './beam-search';
import type { ScoringFn, Move } from './types';

interface RunConfig {
  board: { name: string; board: BoardState; generalCoord: Coord };
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
  const results: RunResult[] = [];

  for (const config of configs) {
    const result = solve(config.board.board, config.board.generalCoord, {
      beamWidth: config.beamWidth,
      maxTicks: config.maxTicks,
      scoringFn: config.scoringFn.fn,
    });

    results.push({
      boardName: config.board.name,
      scoringFnName: config.scoringFn.name,
      beamWidth: config.beamWidth,
      maxTicks: config.maxTicks,
      finalLand: result.finalLand,
      landCurve: result.landCurve,
      durationMs: Math.round(result.perf.totalMs),
      moves: result.moves,
      perf: result.perf,
    });
  }

  return results;
}

export type { RunConfig, RunResult };
export { runComparison };
