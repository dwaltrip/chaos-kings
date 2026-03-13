import type { Coord, Direction, GameState } from '@core/types';

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
}

interface SimulationResult {
  finalLand: number;
  landCurve: number[];
  finalState: GameState;
}

export type { Move, ScoringFn, SolverConfig, SolverResult, SimulationResult };
