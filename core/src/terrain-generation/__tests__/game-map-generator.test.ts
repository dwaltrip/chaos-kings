import { generateGameMapV2 } from '../game-map-generator';
import { SquareType } from '@core/types';

describe('generateGameMapV2', () => {
  it('should generate a valid game map with correct structure', () => {
    const result = generateGameMapV2(
      { width: 10, height: 10 },
      2,
      5,
      42, // Fixed seed for deterministic testing
    );

    expect(result.grid).toBeDefined();
    expect(result.generals).toBeDefined();
    expect(result.generals).toHaveLength(2);

    // Verify grid structure
    expect(result.grid).toHaveLength(10);
    for (const row of result.grid) {
      expect(row).toHaveLength(10);
    }

    // Verify generals are placed correctly
    for (let i = 0; i < result.generals.length; i++) {
      const general = result.generals[i];
      expect(general.type).toBe(SquareType.GENERAL);
      expect(general.playerIndex).toBe(i);
      expect(general.units).toBe(1);

      const { x, y } = general.coord;
      expect(result.grid[y][x]).toBe(general);
    }

    // Verify grid contains mountains
    let mountainCount = 0;
    for (const row of result.grid) {
      for (const square of row) {
        if (square.type === SquareType.MOUNTAIN) {
          mountainCount++;
        }
      }
    }
    expect(mountainCount).toBeGreaterThan(0);
  });

  it('should enforce minimum general distance', () => {
    const result = generateGameMapV2(
      { width: 20, height: 20 },
      3,
      8, // Minimum distance of 8
      123,
    );

    expect(result.generals).toHaveLength(3);

    // Check distances between all pairs of generals
    for (let i = 0; i < result.generals.length; i++) {
      for (let j = i + 1; j < result.generals.length; j++) {
        const gen1 = result.generals[i];
        const gen2 = result.generals[j];
        const distance =
          Math.abs(gen1.coord.x - gen2.coord.x) +
          Math.abs(gen1.coord.y - gen2.coord.y);
        expect(distance).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it('should be deterministic with same seed', () => {
    const result1 = generateGameMapV2({ width: 8, height: 8 }, 2, 4, 555);
    const result2 = generateGameMapV2({ width: 8, height: 8 }, 2, 4, 555);

    // Grids should be identical
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const square1 = result1.grid[y][x];
        const square2 = result2.grid[y][x];

        expect(square1.type).toBe(square2.type);
        expect(square1.coord).toEqual(square2.coord);

        if ('playerIndex' in square1 && 'playerIndex' in square2) {
          expect(square1.playerIndex).toBe(square2.playerIndex);
          expect(square1.units).toBe(square2.units);
        }
      }
    }

    // Generals should be in the same positions
    expect(result1.generals).toHaveLength(result2.generals.length);
    for (let i = 0; i < result1.generals.length; i++) {
      expect(result1.generals[i].coord).toEqual(result2.generals[i].coord);
      expect(result1.generals[i].playerIndex).toBe(
        result2.generals[i].playerIndex,
      );
    }
  });

  it('should throw error if unable to place generals', () => {
    expect(() => {
      generateGameMapV2(
        { width: 3, height: 3 }, // Very small map
        4, // Too many players
        5, // Large minimum distance
        777,
      );
    }).toThrow();
  });
});
