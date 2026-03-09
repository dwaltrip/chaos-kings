import type {
  BoardState as CoreBoardState,
  Coord,
  CorePlayerState,
  Movement,
  PlayerIndex,
} from '@core/types';
import type { Player } from '@platform/domains/games/types';

import type { BoardSessionInputState } from './types';

function setStatus(state: BoardSessionInputState, status: 'active' | 'ended'): void {
  state.game.status = status;
}

function setSelectedTile(state: BoardSessionInputState, coord: Coord | null): void {
  state.ui.selectedTile = coord;
}

function addQueuedMove(state: BoardSessionInputState, move: Movement): void {
  state.game.queuedMoves = [...state.game.queuedMoves, move];
}

function undoLastQueuedMove(state: BoardSessionInputState): void {
  state.game.queuedMoves = state.game.queuedMoves.slice(0, -1);
}

function setQueuedMoves(state: BoardSessionInputState, moves: Movement[]): void {
  state.game.queuedMoves = moves;
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

export {
  setStatus,
  setSelectedTile,
  addQueuedMove,
  undoLastQueuedMove,
  setQueuedMoves,
  applyTick,
  initBoard,
};
