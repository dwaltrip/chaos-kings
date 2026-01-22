import type { BoardState, Coord, PlayerIndex } from '@core/types';
import { Direction, PlayerSquareType, SquareType } from '@core/types';
import { Board } from '@core/board';
import { isPlayerSquare } from '@core/square';

interface MoveResult {
  capture?: {
    defeated: PlayerIndex;
    capturedBy: PlayerIndex;
  };
}

function applyMovement(
  board: BoardState,
  sourceCoord: Coord,
  movement: Direction,
): MoveResult {
  if (!Board.canMove(board, sourceCoord, movement)) {
    console.warn('[applyMovement] Cannot move');
    return {};
  }

  const source = Board.getSquare(board, sourceCoord);
  if (!isPlayerSquare(source)) {
    throw new Error('Source is not a player square');
  }
  const dest = Board.getSquare(board, sourceCoord, movement);

  // Case 1: dest is blank
  if (dest.type === SquareType.BLANK) {
    const newDest = {
      ...dest,
      type: SquareType.ARMY,
      playerIndex: source.playerIndex,
      units: source.units - 1,
    };
    source.units = 1;
    Board.replaceSquare(board, dest.coord, newDest);
    return {};
  } else if (!isPlayerSquare(dest)) {
    throw new Error('Destination is not a player square');
  }

  // Case 2: dest is friendly
  if (dest.playerIndex === source.playerIndex) {
    dest.units += source.units - 1;
    source.units = 1;
    return {};
  }

  // Case 3: dest is enemy
  // Case 3a: Enemy defends successfully
  // You need 2 units more than the enemy to capture
  // As you leave 1 unit behind in the source tile, and defender wins ties
  if (source.units <= dest.units + 1) {
    dest.units -= source.units - 1;
    source.units = 1;
    return {};
  }

  // Case 3b/3c: Attacker wins
  const survivingUnits = source.units - dest.units;
  dest.units = survivingUnits - 1;
  source.units = 1;

  // Case 3c: Enemy general is captured
  if (dest.type === PlayerSquareType.GENERAL) {
    const defeatedPlayerIndex = dest.playerIndex;
    const capturerPlayerIndex = source.playerIndex;
    dest.type = PlayerSquareType.PLAYER_CITY;
    dest.playerIndex = capturerPlayerIndex;

    // Collect all squares owned by the defeated player first
    // (to avoid modifying while iterating)
    const defeatedPlayerSquares = [];
    for (let square of Board.iterPlayerSquares(board, defeatedPlayerIndex)) {
      defeatedPlayerSquares.push(square);
    }

    // Transfer ownership and halve units
    for (let square of defeatedPlayerSquares) {
      square.playerIndex = capturerPlayerIndex;
      if (square != dest) {
        square.units = Math.max(1, Math.floor(square.units / 2));
      }
    }

    return {
      capture: {
        defeated: defeatedPlayerIndex,
        capturedBy: capturerPlayerIndex,
      },
    };
  }

  // Case 3b: Regular enemy square is captured (non-general)
  dest.playerIndex = source.playerIndex;
  return {};
}

export type { MoveResult };
export { applyMovement };
