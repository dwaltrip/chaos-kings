import type { BoardState, Movement } from '@core/types';

import { applyTick } from '@/domains/games/board-store';
import { usePuzzleStore } from '@/domains/puzzles/stores/puzzle-store';

function handleStateUpdate(tick: number, board: BoardState, moveQueue: Movement[]): void {
  const { setStatus } = usePuzzleStore.getState().actions;

  applyTick(tick, board, moveQueue, []);
  setStatus('playing');
}

export { handleStateUpdate };
