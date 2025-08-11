import { tick } from '@core/engine';
import { generateRandomMap } from '@core/map/generate-grid';
import { BoardState, SquareType } from '@core/types';

describe('tick function', () => {
  let board: BoardState;
  let generals: any[];

  beforeEach(() => {
    const size = { width: 10, height: 10 };
    const mapResult = generateRandomMap(size, 2);
    board = { grid: mapResult.grid, size };
    generals = mapResult.generals;
  });

  test('should produce units for generals every 4 ticks', () => {
    const initialUnits = generals[0].units;
    
    // Tick 1-3: no production
    tick(board, 1);
    tick(board, 2);
    tick(board, 3);
    expect(generals[0].units).toBe(initialUnits);
    
    // Tick 4: production occurs
    tick(board, 4);
    expect(generals[0].units).toBe(initialUnits + 1);
    
    // Tick 8: production occurs again
    tick(board, 8);
    expect(generals[0].units).toBe(initialUnits + 2);
  });

  test('should produce units for armies every 100 ticks', () => {
    // Add an army square to test
    const armySquare = {
      coord: { x: 5, y: 5 },
      type: SquareType.ARMY,
      playerIndex: 0,
      units: 5
    };
    board.grid[5][5] = armySquare;
    
    const initialUnits = armySquare.units;
    
    // Tick 99: no production
    tick(board, 99);
    expect(armySquare.units).toBe(initialUnits);
    
    // Tick 100: production occurs
    tick(board, 100);
    expect(armySquare.units).toBe(initialUnits + 1);
  });

  test('should detect victory when only one general remains', () => {
    // Remove one general by converting it to a blank square
    const firstGeneral = generals[0];
    board.grid[firstGeneral.coord.y][firstGeneral.coord.x] = {
      coord: firstGeneral.coord,
      type: SquareType.BLANK
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
      type: SquareType.BLANK
    };
    
    const remainingGeneral = generals[1];
    const initialUnits = remainingGeneral.units;
    
    // Tick 4: should produce units AND detect victory
    const result = tick(board, 4);
    expect(result.gameEnded).toBe(true);
    expect(result.winnerPlayerIndex).toBe(remainingGeneral.playerIndex);
    expect(remainingGeneral.units).toBe(initialUnits + 1); // Production still happens
  });
});