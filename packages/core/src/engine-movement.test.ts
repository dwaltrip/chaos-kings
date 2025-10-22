import { applyMovement } from '@core/engine';
import { Board } from '@core/board';
import { BoardState, Direction, SquareType, PlayerSquareType } from '@core/types';

describe('applyMovement function', () => {
  let board: BoardState;

  beforeEach(() => {
    // Create a 5x5 test board
    board = {
      size: { width: 5, height: 5 },
      grid: Array(5)
        .fill(null)
        .map((_, y) =>
          Array(5)
            .fill(null)
            .map((_, x) => ({
              coord: { x, y },
              type: SquareType.BLANK,
            })),
        ),
    };
  });

  describe('movement to empty squares', () => {
    test('should move army to empty square', () => {
      // Place an army at (1,1)
      board.grid[1][1] = {
        coord: { x: 1, y: 1 },
        type: SquareType.ARMY,
        playerIndex: 0,
        units: 5,
      };

      applyMovement(board, { x: 1, y: 1 }, Direction.RIGHT);

      // Source should have 1 unit left
      expect(board.grid[1][1]).toMatchObject({
        type: SquareType.ARMY,
        playerIndex: 0,
        units: 1,
      });

      // Destination should have 4 units
      expect(board.grid[1][2]).toMatchObject({
        type: SquareType.ARMY,
        playerIndex: 0,
        units: 4,
      });
    });

    test('should move general to empty square', () => {
      board.grid[2][2] = {
        coord: { x: 2, y: 2 },
        type: SquareType.GENERAL,
        playerIndex: 1,
        units: 8,
      };

      applyMovement(board, { x: 2, y: 2 }, Direction.UP);

      // Source should have 1 unit left
      expect(board.grid[2][2]).toMatchObject({
        type: SquareType.GENERAL,
        playerIndex: 1,
        units: 1,
      });

      // Destination should have 7 units as army
      expect(board.grid[1][2]).toMatchObject({
        type: SquareType.ARMY,
        playerIndex: 1,
        units: 7,
      });
    });
  });

  describe('movement to friendly squares', () => {
    test('should merge units when moving to friendly army', () => {
      // Source army
      board.grid[0][0] = {
        coord: { x: 0, y: 0 },
        type: SquareType.ARMY,
        playerIndex: 0,
        units: 6,
      };

      // Friendly destination army
      board.grid[0][1] = {
        coord: { x: 0, y: 1 },
        type: SquareType.ARMY,
        playerIndex: 0,
        units: 3,
      };

      applyMovement(board, { x: 0, y: 0 }, Direction.RIGHT);

      // Source should have 1 unit left
      expect(board.grid[0][0]).toMatchObject({
        units: 1,
      });

      // Destination should have combined units
      expect(board.grid[0][1]).toMatchObject({
        units: 8, // 3 + (6-1)
      });
    });

    test('should merge units when moving to friendly city', () => {
      board.grid[1][1] = {
        coord: { x: 1, y: 1 },
        type: SquareType.ARMY,
        playerIndex: 0,
        units: 4,
      };

      board.grid[1][2] = {
        coord: { x: 1, y: 2 },
        type: SquareType.PLAYER_CITY,
        playerIndex: 0,
        units: 2,
      };

      applyMovement(board, { x: 1, y: 1 }, Direction.RIGHT);

      expect(board.grid[1][1]).toMatchObject({ units: 1 });
      expect(board.grid[1][2]).toMatchObject({
        type: SquareType.PLAYER_CITY,
        units: 5, // 2 + (4-1)
      });
    });
  });

  describe('combat with enemy squares', () => {
    test('should lose to stronger enemy', () => {
      // Attacking army (weaker)
      board.grid[0][2] = {
        coord: { x: 2, y: 0 },
        type: SquareType.ARMY,
        playerIndex: 0,
        units: 3,
      };

      // Defending army (stronger)
      board.grid[1][2] = {
        coord: { x: 2, y: 1 },
        type: SquareType.ARMY,
        playerIndex: 1,
        units: 5,
      };

      applyMovement(board, { x: 2, y: 0 }, Direction.DOWN);

      // Attacker should have 1 unit surviving (as you always leave one behind)
      expect(board.grid[0][2]).toMatchObject({
        units: 1,
      });

      // Defender should have reduced units but keep ownership
      expect(board.grid[1][2]).toMatchObject({
        playerIndex: 1,
        units: 3, // 5 - 2 (attacker leaves 1 behind)
      });
    });

    test('should capture weaker enemy square', () => {
      // Attacking army (stronger)
      board.grid[3][3] = {
        coord: { x: 3, y: 3 },
        type: SquareType.ARMY,
        playerIndex: 0,
        units: 7,
      };

      // Defending army (weaker)
      board.grid[4][3] = {
        coord: { x: 3, y: 4 },
        type: SquareType.ARMY,
        playerIndex: 1,
        units: 4,
      };

      applyMovement(board, { x: 3, y: 3 }, Direction.DOWN);

      // Source should have 1 unit left
      expect(board.grid[3][3]).toMatchObject({
        units: 1,
      });

      // Destination should be captured with remaining units
      expect(board.grid[4][3]).toMatchObject({
        playerIndex: 0, // Captured!
        units: 2, // (7 - 4) - 1
      });
    });
  });

  describe('general capture and land transfer', () => {
    test('should capture enemy general and transfer all land', () => {
      // Set up player 0's attacking force
      board.grid[1][2] = {
        coord: { x: 2, y: 1 },
        type: SquareType.ARMY,
        playerIndex: 0,
        units: 5,
      };

      // Set up player 1's general
      board.grid[2][2] = {
        coord: { x: 2, y: 2 },
        type: SquareType.GENERAL,
        playerIndex: 1,
        units: 2,
      };

      // Set up player 1's other territories
      board.grid[1][1] = {
        coord: { x: 1, y: 1 },
        type: SquareType.ARMY,
        playerIndex: 1,
        units: 6,
      };

      board.grid[3][3] = {
        coord: { x: 3, y: 3 },
        type: SquareType.PLAYER_CITY,
        playerIndex: 1,
        units: 4,
      };

      board.grid[4][0] = {
        coord: { x: 0, y: 4 },
        type: SquareType.ARMY,
        playerIndex: 1,
        units: 8,
      };

      // Execute the general capture
      applyMovement(board, { x: 2, y: 1 }, Direction.DOWN);

      // Source should have 1 unit left
      expect(board.grid[1][2]).toMatchObject({
        units: 1,
      });

      // Former general should become player city owned by player 0
      expect(board.grid[2][2]).toMatchObject({
        type: SquareType.PLAYER_CITY,
        playerIndex: 0,
        units: 2, // (5 - 2) - 1, but general doesn't get halved
      });

      // All other territories should be transferred to player 0 with halved units
      expect(board.grid[1][1]).toMatchObject({
        playerIndex: 0,
        units: 3, // Math.ceil(6 / 2)
      });

      expect(board.grid[3][3]).toMatchObject({
        playerIndex: 0,
        units: 2, // Math.ceil(4 / 2)
      });

      expect(board.grid[4][0]).toMatchObject({
        playerIndex: 0,
        units: 4, // Math.ceil(8 / 2)
      });
    });

    test('should handle general capture with odd unit counts', () => {
      // Attacking force
      board.grid[0][0] = {
        coord: { x: 0, y: 0 },
        type: SquareType.GENERAL,
        playerIndex: 0,
        units: 4,
      };

      // Enemy general
      board.grid[0][1] = {
        coord: { x: 0, y: 1 },
        type: SquareType.GENERAL,
        playerIndex: 1,
        units: 2,
      };

      // Enemy territories with odd unit counts
      board.grid[1][0] = {
        coord: { x: 1, y: 0 },
        type: SquareType.ARMY,
        playerIndex: 1,
        units: 5,
      };

      board.grid[2][0] = {
        coord: { x: 2, y: 0 },
        type: SquareType.PLAYER_CITY,
        playerIndex: 1,
        units: 3,
      };

      applyMovement(board, { x: 0, y: 0 }, Direction.RIGHT);

      // Check that odd units are rounded down when halved
      expect(board.grid[1][0]).toMatchObject({
        playerIndex: 0,
        units: 2, // Math.floor(5 / 2)
      });

      expect(board.grid[2][0]).toMatchObject({
        playerIndex: 0,
        units: 1, // Math.floor(3 / 2)
      });
    });

    test('should not transfer land when general capture fails', () => {
      // Weak attacking force
      board.grid[1][1] = {
        coord: { x: 1, y: 1 },
        type: SquareType.ARMY,
        playerIndex: 0,
        units: 2,
      };

      // Strong enemy general
      board.grid[1][2] = {
        coord: { x: 1, y: 2 },
        type: SquareType.GENERAL,
        playerIndex: 1,
        units: 5,
      };

      // Other enemy territory
      board.grid[3][3] = {
        coord: { x: 3, y: 3 },
        type: SquareType.ARMY,
        playerIndex: 1,
        units: 4,
      };

      applyMovement(board, { x: 1, y: 1 }, Direction.RIGHT);

      // Attack should fail
      expect(board.grid[1][1]).toMatchObject({
        units: 1,
      });

      // General should survive with reduced units
      expect(board.grid[1][2]).toMatchObject({
        type: SquareType.GENERAL,
        playerIndex: 1,
        units: 4, // 5 - 1 (attacker leaves 1 behind)
      });

      // Other territory should remain unchanged
      expect(board.grid[3][3]).toMatchObject({
        playerIndex: 1,
        units: 4,
      });
    });
  });
});
