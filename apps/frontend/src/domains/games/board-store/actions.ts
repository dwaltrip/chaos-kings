import type {
  BoardState as CoreBoardState,
  Coord,
  CorePlayerState,
  Movement,
  PlayerIndex,
} from '@core/types';
import type { Player } from '@platform/domains/games/types';

import type { BoardStoreState } from './types';

function setStatus(state: BoardStoreState, status: 'active' | 'ended'): void {
  state.source.status = status;
}

function setSelectedTile(state: BoardStoreState, coord: Coord | null): void {
  state.ui.selectedTile = coord;
}

function addQueuedMove(state: BoardStoreState, move: Movement): void {
  state.source.queuedMoves = [...state.source.queuedMoves, move];
}

function undoLastQueuedMove(state: BoardStoreState): void {
  state.source.queuedMoves = state.source.queuedMoves.slice(0, -1);
}

function setQueuedMoves(state: BoardStoreState, moves: Movement[]): void {
  state.source.queuedMoves = moves;
}

function applyTick(
  state: BoardStoreState,
  tick: number,
  board: CoreBoardState,
  queuedMoves: Movement[],
  playerStats: CorePlayerState[],
  winner?: PlayerIndex,
): void {
  state.source.tick = tick;
  state.source.board = board;
  state.source.queuedMoves = queuedMoves;
  state.source.playerStats = playerStats;
  if (winner != null) state.source.winner = winner;
}

function initBoard(
  state: BoardStoreState,
  players: Player[],
  currentPlayerIndex: PlayerIndex | null,
  board?: CoreBoardState,
): void {
  state.source.players = players;
  state.source.currentPlayerIndex = currentPlayerIndex;
  if (board) {
    state.source.board = board;
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
