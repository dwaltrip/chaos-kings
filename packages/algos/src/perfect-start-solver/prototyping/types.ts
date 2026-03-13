import type { Coord, Direction, GameState } from '@core/types';
import type { FlatBoard } from '@/core-next/flat-board';

import type { PerfStats } from './beam-search';

type Move = {
  sourceCoord: Coord;
  direction: Direction;
} | null; // null = wait

type ScoringFn = (board: FlatBoard) => number;

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

interface ArmySnapshot {
  coord: Coord;
  units: number;
}

interface SimulationResult {
  finalLand: number;
  landCurve: number[];
  generalArmyCurve: number[];
  armySnapshots: ArmySnapshot[][]; // top tiles per tick
  finalState: GameState;
}

export type {
  Move,
  ScoringFn,
  SolverConfig,
  SolverResult,
  ArmySnapshot,
  SimulationResult,
};
