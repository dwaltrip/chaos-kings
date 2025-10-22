import { Board } from '@core/board';
import { isPlayerSquare } from '@core/square';
import type { BoardState, Coord, Direction } from '@core/types';

type MoveValidationReason =
  | 'invalid_coord'
  | 'not_owner'
  | 'insufficient_units'
  | 'blocked_destination';

function validateMove(
  board: BoardState,
  playerIndex: number,
  sourceCoord: Coord,
  direction: Direction,
): { ok: true } | { ok: false; reason: MoveValidationReason } {
  if (!Board.isCoordValid(board, sourceCoord)) {
    return { ok: false, reason: 'invalid_coord' };
  }

  const source = Board.getSquare(board, sourceCoord);
  if (!isPlayerSquare(source) || source.playerIndex !== playerIndex) {
    return { ok: false, reason: 'not_owner' };
  }
  if (source.units <= 1) {
    return { ok: false, reason: 'insufficient_units' };
  }

  if (!Board.canMove(board, sourceCoord, direction)) {
    return { ok: false, reason: 'blocked_destination' };
  }

  return { ok: true };
}

export { validateMove };
export type { MoveValidationReason };
