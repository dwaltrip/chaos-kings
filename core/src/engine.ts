import { BoardState, Coord, Movement, PlayerSquareType, SquareType } from '@core/types';
import { Board } from '@core/board';
import { isPlayerSquare } from '@core/square';


function tick(board: BoardState, ): void {
  
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

// function handleMove(game: Game, sourceCoord: Coord, direction: Movement) {
function applyMovement(board: BoardState, sourceCoord: Coord, movement: Movement): void {
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
  }
  else if (!isPlayerSquare(dest)) {
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
    if (source.units <= dest.units) {
      dest.units -= source.units;
      source.units = 0;
    }
    // Case 3b: Regular enemy square is captured
    else {
      const surivingUnits = source.units - dest.units;
      dest.units = surivingUnits - 1;
      source.units = 1;
      dest.playerIndex = source.playerIndex;

      // Case 3c: Enemy general is captured
      if (dest.type === PlayerSquareType.GENERAL) {
        dest.type = PlayerSquareType.PLAYER_CITY;

        for (let square of Board.iterPlayerSquares(board, dest.playerIndex)) {
          square.playerIndex = source.playerIndex;
          if (square != dest) {
            square.units = Math.ceil(square.units / 2);
          }
        }
      }
    }
  }
}

export { tick }
