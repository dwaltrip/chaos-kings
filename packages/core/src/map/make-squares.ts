import { SquareType } from '@core/types';
import type { Coord, PlayerSquare } from '@core/types';

function makeGeneralSquare(coord: Coord, playerIndex: number): PlayerSquare {
  return {
    coord,
    type: SquareType.GENERAL,
    playerIndex,
    units: 1,
  };
}

export { makeGeneralSquare };
