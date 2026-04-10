import type { FlatBoard } from '@/core-next/flat-board';

import type { PerfStats } from './beam-search';
import type { Move } from '../types';

type ScoringFn = (board: FlatBoard, tick: number) => number;

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

export type { Move, ScoringFn, SolverConfig, SolverResult };
export type { ArmySnapshot, SimulationResult } from '../types';
