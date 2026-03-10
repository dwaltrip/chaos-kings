import type { Movement } from '@core/types';

const moveHistoryCache = new Map<number, Movement | null>();

let lastExecutedMove: Movement | null = null;

function getLastExecutedMove(): Movement | null {
  return lastExecutedMove;
}

function setLastExecutedMove(move: Movement | null): void {
  lastExecutedMove = move;
}

function resetMoveHistory(): void {
  moveHistoryCache.clear();
  lastExecutedMove = null;
}

export { moveHistoryCache, getLastExecutedMove, setLastExecutedMove, resetMoveHistory };
