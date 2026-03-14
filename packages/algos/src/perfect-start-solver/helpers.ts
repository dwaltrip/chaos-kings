import { Direction } from '@core/types';
import type { MoveEvent } from '@core/replay/types';

import type { Move } from './types';

const ALL_DIRECTIONS: Direction[] = [
  Direction.UP,
  Direction.DOWN,
  Direction.LEFT,
  Direction.RIGHT,
];

function toMoveEvent(move: Move, tick: number): MoveEvent | null {
  if (move === null) return null;
  return {
    step: tick,
    playerIndex: 0,
    sourceCoord: move.sourceCoord,
    direction: move.direction,
  };
}

function runWithTiming<T>(fn: () => T): [T, number] {
  const start = performance.now();
  const result = fn();
  return [result, performance.now() - start];
}

export { ALL_DIRECTIONS, toMoveEvent, runWithTiming };
