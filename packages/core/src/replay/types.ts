import type { Coord, Direction } from '@core/types';
import type { TimingConfig } from '@core/timing/types';

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

export type { MoveEvent, MoveHistoryV1, TimingConfig };
