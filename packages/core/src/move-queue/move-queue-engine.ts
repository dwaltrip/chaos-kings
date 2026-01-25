import { Board } from '@core/board';
import type { BoardState, Coord, Direction, Movement } from '@core/types';

import type { QueueConfig } from './types';
import { DEFAULT_QUEUE_CONFIG } from './types';

class MoveQueueEngine {
  private queue: Movement[] = [];
  private config: QueueConfig;

  constructor(config?: Partial<QueueConfig>) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
  }

  queueMove(source: Coord, direction: Direction, board: BoardState): boolean {
    if (this.queue.length >= this.config.maxSize) {
      return false;
    }

    if (!Board.isCoordValid(board, source)) {
      return false;
    }

    this.queue.push({ sourceCoord: source, direction });
    return true;
  }

  undoMove(): Movement | undefined {
    return this.queue.pop();
  }

  clearMoves(): void {
    this.queue = [];
  }

  shiftMove(): Movement | undefined {
    return this.queue.shift();
  }

  peekMove(): Movement | undefined {
    return this.queue[0];
  }

  getQueue(): Movement[] {
    return [...this.queue];
  }

  getLength(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  // TODO: Grace logic - skip invalid moves, try next in queue
  // shiftValidMove(board: BoardState): Movement | undefined;
}

export { MoveQueueEngine };
