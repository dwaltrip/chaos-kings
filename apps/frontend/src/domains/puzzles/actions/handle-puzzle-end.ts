import type { BoardState } from '@core/types';
import { Board } from '@core/board';
import { serializeCoord } from '@core/utils/coordinate-utils';

import type { BestStartResult } from '@protocol/domains/puzzles/server-messages';

import { tileOrchestrator } from '@/domains/games/stores/tile-orchestrator';
import { usePuzzleStore } from '@/domains/puzzles/stores/puzzle-store';
import { loadUserStats } from '@/domains/puzzles/actions/load-user-stats';

function handlePuzzleEnd(result: BestStartResult, finalBoard: BoardState): void {
  const { setStatus, setResult, setBoard, setVisibleSquares } =
    usePuzzleStore.getState().actions;

  tileOrchestrator.updateTileSquares(finalBoard);
  tileOrchestrator.clearAllQueuedDirections(finalBoard);

  // When ended, all squares are visible
  const allVisible = new Set<string>();
  Board.forEachCoord(finalBoard, (c) => allVisible.add(serializeCoord(c)));

  setStatus('ended');
  setResult(result);
  setBoard(finalBoard);
  setVisibleSquares(allVisible);

  // Reload user stats after puzzle ends (async, fire-and-forget)
  void loadUserStats();
}

export { handlePuzzleEnd };
