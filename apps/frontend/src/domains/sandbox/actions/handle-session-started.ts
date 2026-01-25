import type { BoardState } from '@core/types';
import { Board } from '@core/board';

import type { SandboxConfig } from '@protocol/domains/sandbox/server-messages';

import { tileOrchestrator } from '@/domains/games/stores/tile-orchestrator';
import { useBoardSessionStore } from '@/domains/games/stores/board-session-store';
import { useSandboxMetaStore } from '@/domains/sandbox/stores/sandbox-meta-store';

function handleSessionStarted(board: BoardState, config: SandboxConfig): void {
  const { setBoard, setTick, setVisibleSquares, setQueuedMoves, setIsEnded } =
    useBoardSessionStore.getState().actions;
  const { setStatus, setIsPaused, setConfig } = useSandboxMetaStore.getState().actions;

  tileOrchestrator.updateTileSquares(board);

  const visibleSquares = Board.getVisibleSquares(board, 0);

  setBoard(board);
  setTick(0);
  setVisibleSquares(visibleSquares);
  setQueuedMoves([]);
  setIsEnded(false);

  setStatus('active');
  setIsPaused(true);
  setConfig(config);
}

export { handleSessionStarted };
