import type { BoardState } from '@core/types';

import type { BestStartResult } from '@protocol/domains/puzzles/server-messages';

import {
  applyTick,
  setStatus as setBoardStatus,
  setSelectedTile as setBoardSelectedTile,
} from '@/domains/games/board-store';
import { usePuzzleStore } from '@/domains/puzzles/stores/puzzle-store';
import { loadUserStats } from '@/domains/puzzles/actions/load-user-stats';

function handlePuzzleEnd(
  tick: number,
  result: BestStartResult,
  finalBoard: BoardState,
): void {
  const { setStatus, setResult } = usePuzzleStore.getState().actions;

  applyTick(tick, finalBoard, [], []);
  setBoardStatus('ended');
  setBoardSelectedTile(null);

  setStatus('ended');
  setResult(result);

  // Reload user stats after puzzle ends (async, fire-and-forget)
  void loadUserStats();
}

export { handlePuzzleEnd };
