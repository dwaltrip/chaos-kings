import type { Coord, Direction } from '@core/types';

interface MoveEvent {
  step: number; // 1-based step index
  playerIndex: number;
  sourceCoord: Coord;
  direction: Direction;
}

interface MoveHistoryV1 {
  version: 1;
  events: MoveEvent[];
}

interface TimingConfig {
  tickRateMs: number;
  generalProductionTicks: number;
  armyProductionTicks: number;
}

export type { MoveEvent, MoveHistoryV1, TimingConfig };
