import type {
  BoardState as CoreBoardState,
  Coord,
  CorePlayerState,
  Direction,
  Movement,
  PlayerIndex,
} from '@core/types';
import { Board } from '@core/board';
import type { Player } from '@platform/domains/games/types';

import type { BoardSessionInputState } from './types';

function setStatus(state: BoardSessionInputState, status: 'active' | 'ended'): void {
  state.game.status = status;
}

function setSelectedTile(state: BoardSessionInputState, coord: Coord | null): void {
  state.ui.selectedTile = coord;
  state.ui.hasUserSelectedSinceLastQueue = false;
}

function userSelectTile(state: BoardSessionInputState, coord: Coord | null): void {
  state.ui.selectedTile = coord;
  state.ui.hasUserSelectedSinceLastQueue = true;
}

function undoLastQueuedMove(state: BoardSessionInputState): void {
  const { queuedMoves } = state.game;
  if (queuedMoves.length === 0) return;

  const lastMove = queuedMoves[queuedMoves.length - 1];
  state.game.queuedMoves = queuedMoves.slice(0, -1);

  // Revert selection to source if currently on the undone move's destination
  const dest = Board.applyDirection(lastMove.sourceCoord, lastMove.direction);
  const selected = state.ui.selectedTile;
  if (selected && selected.x === dest.x && selected.y === dest.y) {
    state.ui.selectedTile = lastMove.sourceCoord;
  }
}

function applyTick(
  state: BoardSessionInputState,
  tick: number,
  board: CoreBoardState,
  queuedMoves: Movement[],
  playerStats: CorePlayerState[],
  winner?: PlayerIndex,
): void {
  state.game.tick = tick;
  state.game.board = board;
  state.game.queuedMoves = queuedMoves;
  state.game.playerStats = playerStats;
  if (winner != null) state.game.winner = winner;
}

function initBoard(
  state: BoardSessionInputState,
  players: Player[],
  currentPlayerIndex: PlayerIndex | null,
  board?: CoreBoardState,
): void {
  state.game.players = players;
  state.game.currentPlayerIndex = currentPlayerIndex;
  if (board) {
    state.game.board = board;
  }
}

function queueMoveOnBoard(
  state: BoardSessionInputState,
  source: Coord,
  direction: Direction,
): boolean {
  const { board } = state.game;
  if (!board) return false;
  if (!Board.canMove(board, source, direction)) return false;

  state.game.queuedMoves = [
    ...state.game.queuedMoves,
    { sourceCoord: source, direction },
  ];
  state.ui.selectedTile = Board.applyDirection(source, direction);
  state.ui.hasUserSelectedSinceLastQueue = false;
  return true;
}

function cancelQueuedMoves(state: BoardSessionInputState): boolean {
  const { queuedMoves, board, currentPlayerIndex } = state.game;
  if (queuedMoves.length === 0) return false;

  const snapTarget = queuedMoves[0].sourceCoord;
  const shouldSnap = !state.ui.hasUserSelectedSinceLastQueue;

  state.game.queuedMoves = [];
  state.ui.hasUserSelectedSinceLastQueue = false;

  // Snap selection back to where execution reached, unless the user
  // manually selected a different tile or the tile is no longer ours.
  if (shouldSnap && board && currentPlayerIndex != null) {
    if (Board.doesPlayerOwnSquare(board, snapTarget, currentPlayerIndex)) {
      state.ui.selectedTile = snapTarget;
    }
  }

  return true;
}

export {
  setStatus,
  setSelectedTile,
  userSelectTile,
  undoLastQueuedMove,
  applyTick,
  initBoard,
  queueMoveOnBoard,
  cancelQueuedMoves,
};
