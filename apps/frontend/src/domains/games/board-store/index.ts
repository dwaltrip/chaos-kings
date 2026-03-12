import * as rawActions from './actions';
import { createBoardStore } from './board-store';
import type {
  BoardSessionInputState,
  BoardSessionState,
  BoardSourceState,
  DerivedState,
  TileData,
  UIState,
} from './types';

const boardStore = createBoardStore();

const initBoard = boardStore.makeAction(rawActions.initBoard);
const applyTick = boardStore.makeAction(rawActions.applyTick);
const setStatus = boardStore.makeAction(rawActions.setStatus);
const setSelectedTile = boardStore.makeAction(rawActions.setSelectedTile);
const userSelectTile = boardStore.makeAction(rawActions.userSelectTile);
const addQueuedMove = boardStore.makeAction(rawActions.addQueuedMove);
const undoLastQueuedMove = boardStore.makeAction(rawActions.undoLastQueuedMove);
const setQueuedMoves = boardStore.makeAction(rawActions.setQueuedMoves);
const cancelQueuedMoves = boardStore.makeAction(rawActions.cancelQueuedMoves);

export type {
  BoardSessionState,
  BoardSessionInputState,
  BoardSourceState,
  UIState,
  DerivedState,
  TileData,
};
export {
  boardStore,
  initBoard,
  applyTick,
  setStatus,
  setSelectedTile,
  userSelectTile,
  addQueuedMove,
  undoLastQueuedMove,
  setQueuedMoves,
  cancelQueuedMoves,
};
