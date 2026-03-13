import type { BoardState, Coord } from '@core/types';

import { solve } from './solver';
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
}

function runComparison(configs: RunConfig[]): RunResult[] {
  const results: RunResult[] = [];

  for (const config of configs) {
    const start = Date.now();

    const result = solve(config.board.board, config.board.generalCoord, {
      beamWidth: config.beamWidth,
      maxTicks: config.maxTicks,
      scoringFn: config.scoringFn.fn,
    });

    const durationMs = Date.now() - start;

    results.push({
      boardName: config.board.name,
      scoringFnName: config.scoringFn.name,
      beamWidth: config.beamWidth,
      maxTicks: config.maxTicks,
      finalLand: result.finalLand,
      landCurve: result.landCurve,
      durationMs,
      moves: result.moves,
    });
  }

  return results;
}

export type { RunConfig, RunResult };
export { runComparison };
