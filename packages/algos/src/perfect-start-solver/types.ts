import type { Coord, Direction, GameState } from '@core/types';

type Move = {
  sourceCoord: Coord;
  direction: Direction;
} | null; // null = wait

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

export type { Move, ArmySnapshot, SimulationResult };
