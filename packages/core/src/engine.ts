import { BoardState, Coord, Direction, PlayerSquareType, SquareType } from '@core/types';
import { Board } from '@core/board';
import { isPlayerSquare } from '@core/square';
import {
  GENERAL_PRODUCTION_TICKS,
  ARMY_PRODUCTION_TICKS,
} from '@core/game-timing-config';

function tick(
  board: BoardState,
  tickNumber: number,
): { gameEnded: boolean; winnerPlayerIndex?: number } {
  // General production: +1 unit every GENERAL_PRODUCTION_TICKS
  if (tickNumber % GENERAL_PRODUCTION_TICKS === 0) {
    applyCityProduction(board);
  }

  // Army production: +1 unit every ARMY_PRODUCTION_TICKS
  if (tickNumber % ARMY_PRODUCTION_TICKS === 0) {
    applyTroopProduction(board);
  }

  // Check for victory condition (no generals remaining for a player)
  const playersWithGenerals = new Set<number>();
  for (let row of board.grid) {
    for (let square of row) {
      if (square.type === 'GENERAL') {
        playersWithGenerals.add(square.playerIndex);
      }
    }
  }

  if (playersWithGenerals.size === 1) {
    const winnerPlayerIndex = Array.from(playersWithGenerals)[0];
    return { gameEnded: true, winnerPlayerIndex };
  }

  return { gameEnded: false };
}

// ----------------------------------------------------------------------------

function applyCityProduction(board: BoardState): void {
  for (let row of board.grid) {
    for (let square of row) {
      if (square.type === 'PLAYER_CITY' || square.type === 'GENERAL') {
        square.units += 1;
      }
    }
  }
}

function applyTroopProduction(board: BoardState): void {
  for (let row of board.grid) {
    for (let square of row) {
      if (square.type === 'ARMY') {
        square.units += 1;
      }
    }
  }
}

// function handleMove(game: Game, sourceCoord: Coord, direction: Direction) {
function applyMovement(board: BoardState, sourceCoord: Coord, movement: Direction): void {
  // const board = game.board;
  if (!Board.canMove(board, sourceCoord, movement)) {
    console.warn('[handleMove] Cannot move');
    return;
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
    return;
  } else if (!isPlayerSquare(dest)) {
    throw new Error('Destination is not a player square');
  }

  // Case 2: dest is friendly
  if (dest.playerIndex === source.playerIndex) {
    dest.units += source.units - 1;
    source.units = 1;
  }

  // Case 3: dest is enemy
  else if (dest.playerIndex !== source.playerIndex) {
    // Case 3a: Enemy defends successfully
    // You need 2 units more than the enemy to capture
    // As you leave 1 unit behind in the source tile, and defender wins ties
    if (source.units <= dest.units + 1) {
      dest.units -= source.units - 1;
      source.units = 1;
      return;
    }
    // Case 3b: Regular enemy square is captured
    else {
      const surivingUnits = source.units - dest.units;
      dest.units = surivingUnits - 1;
      source.units = 1;

      // Case 3c: Enemy general is captured
      if (dest.type === PlayerSquareType.GENERAL) {
        const defeatedPlayerIndex = dest.playerIndex; // Save before changing ownership
        dest.type = PlayerSquareType.PLAYER_CITY;
        dest.playerIndex = source.playerIndex;

        // Collect all squares owned by the defeated player first
        // (to avoid modifying while iterating)
        const defeatedPlayerSquares = [];
        for (let square of Board.iterPlayerSquares(board, defeatedPlayerIndex)) {
          defeatedPlayerSquares.push(square);
        }

        // Transfer ownership and halve units
        for (let square of defeatedPlayerSquares) {
          square.playerIndex = source.playerIndex;
          if (square != dest) {
            square.units = Math.max(1, Math.floor(square.units / 2));
          }
        }
      }
      // Case 3b: Regular enemy square is captured (non-general)
      else {
        dest.playerIndex = source.playerIndex;
      }
    }
  }
}

export { tick, applyMovement };
