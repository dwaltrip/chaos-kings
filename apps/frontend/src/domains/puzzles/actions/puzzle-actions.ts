import type { BoardState, Coord, Direction, Movement } from '@core/types';
import { Board } from '@core/board';
import type { BestStartResult } from '@protocol/domains/puzzles/server-messages';

import { usePuzzleStore } from '@/domains/puzzles/stores/puzzle-store';
import { puzzlesWsEffects } from '@/domains/puzzles/ws-effects';

// --- Outbound actions (send WS messages) ---

function startPuzzle(): void {
  usePuzzleStore.getState().actions.reset();
  puzzlesWsEffects.sendStartPlaying();
}

function queueMove(source: Coord, direction: Direction): void {
  const { board, actions } = usePuzzleStore.getState();
  if (!board) return;

  // Basic validation - only check bounds and blocked destination (matches gameplay)
  if (!Board.canMove(board, source, direction)) {
    return;
  }

  // Immediately add to local queue for instant arrow feedback
  actions.addQueuedMove({ sourceCoord: source, direction });

  // Move selected tile in the direction of the move
  const newSelected = Board.applyDirection(source, direction);
  actions.setSelectedTile(newSelected);

  // Send to server
  puzzlesWsEffects.sendMoveRequest(source, direction);
}

function undoMove(): void {
  puzzlesWsEffects.sendUndoMove();
}

function clearMoves(): void {
  puzzlesWsEffects.sendCancelMoves();
}

// --- Inbound actions (update store from server messages) ---

function handleStateUpdate(tick: number, board: BoardState, moveQueue: Movement[]): void {
  usePuzzleStore.getState().actions.updateState(tick, board, moveQueue);
}

function handlePuzzleEnd(result: BestStartResult, finalBoard: BoardState): void {
  usePuzzleStore.getState().actions.setEnded(result, finalBoard);
}

export {
  startPuzzle,
  queueMove,
  undoMove,
  clearMoves,
  handleStateUpdate,
  handlePuzzleEnd,
};
