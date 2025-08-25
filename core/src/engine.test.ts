import { tick } from '@core/engine';
import { generateRandomMap } from '@core/map/generate-grid';
import { BoardState, SquareType } from '@core/types';
import {
  GENERAL_PRODUCTION_TICKS,
  ARMY_PRODUCTION_TICKS,
} from '@core/game-timing-config';

describe('tick function', () => {
  let board: BoardState;
  let generals: any[];

  beforeEach(() => {
    const size = { width: 10, height: 10 };
    const mapResult = generateRandomMap(size, 2);
    board = { grid: mapResult.grid, size };
    generals = mapResult.generals;
  });

  test(`should produce units for generals every ${GENERAL_PRODUCTION_TICKS} ticks`, () => {
    const initialUnits = generals[0].units;

    // Test no production before first interval
    for (let tickNum = 1; tickNum < GENERAL_PRODUCTION_TICKS; tickNum++) {
      tick(board, tickNum);
      expect(generals[0].units).toBe(initialUnits);
    }

    // First production interval: production occurs
    tick(board, GENERAL_PRODUCTION_TICKS);
    expect(generals[0].units).toBe(initialUnits + 1);

    // Second production interval: production occurs again
    tick(board, GENERAL_PRODUCTION_TICKS * 2);
    expect(generals[0].units).toBe(initialUnits + 2);
  });

  test(`should produce units for armies every ${ARMY_PRODUCTION_TICKS} ticks`, () => {
    // Add an army square to test
    const armySquare = {
      coord: { x: 5, y: 5 },
      type: SquareType.ARMY,
      playerIndex: 0,
      units: 5,
    };
    board.grid[5][5] = armySquare;

    const initialUnits = armySquare.units;

    // No production before first interval
    tick(board, ARMY_PRODUCTION_TICKS - 1);
    expect(armySquare.units).toBe(initialUnits);

    // First production interval: production occurs
    tick(board, ARMY_PRODUCTION_TICKS);
    expect(armySquare.units).toBe(initialUnits + 1);
  });

  test('should detect victory when only one general remains', () => {
    // Remove one general by converting it to a blank square
    const firstGeneral = generals[0];
    board.grid[firstGeneral.coord.y][firstGeneral.coord.x] = {
      coord: firstGeneral.coord,
      type: SquareType.BLANK,
    };

    const result = tick(board, 1);
    expect(result.gameEnded).toBe(true);
    expect(result.winnerPlayerIndex).toBe(generals[1].playerIndex);
  });

  test('should not detect victory when multiple generals remain', () => {
    const result = tick(board, 1);
    expect(result.gameEnded).toBe(false);
    expect(result.winnerPlayerIndex).toBeUndefined();
  });

  test('should combine production and victory detection', () => {
    // Remove one general
    const firstGeneral = generals[0];
    board.grid[firstGeneral.coord.y][firstGeneral.coord.x] = {
      coord: firstGeneral.coord,
      type: SquareType.BLANK,
    };

    const remainingGeneral = generals[1];
    const initialUnits = remainingGeneral.units;

    // Production tick: should produce units AND detect victory
    const result = tick(board, GENERAL_PRODUCTION_TICKS);
    expect(result.gameEnded).toBe(true);
    expect(result.winnerPlayerIndex).toBe(remainingGeneral.playerIndex);
    expect(remainingGeneral.units).toBe(initialUnits + 1); // Production still happens
  });
});
