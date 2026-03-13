import type { Coord, Direction, GameState } from '@core/types';

type Move = {
  sourceCoord: Coord;
  direction: Direction;
} | null; // null = wait

interface SolverState {
  gameState: GameState;
  moves: Move[];
  landCount: number;
}

type ScoringFn = (state: SolverState) => number;

interface SolverConfig {
  beamWidth: number;
  maxTicks: number;
  scoringFn: ScoringFn;
}

interface SolverResult {
  bestState: SolverState;
  finalLand: number;
  landCurve: number[];
  moves: Move[];
}

interface SimulationResult {
  finalLand: number;
  landCurve: number[];
  finalState: GameState;
}

export type {
  Move,
  SolverState,
  ScoringFn,
  SolverConfig,
  SolverResult,
  SimulationResult,
};
