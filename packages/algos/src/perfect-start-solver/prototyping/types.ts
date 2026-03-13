import type { Coord, Direction, GameState } from '@core/types';

import type { PerfStats } from './beam-search';

type Move = {
  sourceCoord: Coord;
  direction: Direction;
} | null; // null = wait

type ScoringFn = (gameState: GameState) => number;

interface SolverConfig {
  beamWidth: number;
  maxTicks: number;
  scoringFn: ScoringFn;
}

interface SolverResult {
  finalLand: number;
  landCurve: number[];
  moves: Move[];
  perf: PerfStats;
}

interface SimulationResult {
  finalLand: number;
  landCurve: number[];
  generalArmyCurve: number[];
  finalState: GameState;
}

export type { Move, ScoringFn, SolverConfig, SolverResult, SimulationResult };
