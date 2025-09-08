import {
  generateTerrain,
  RandomCandidateGenerator,
  Grid,
} from '@core/terrain-generation';
import { generateRandomTerrain } from '@core/terrain-generation/generate-random-terrain';
import { CellState } from '@core/terrain-generation/types';
import {
  DebugRenderer,
  PerformanceProfiler,
} from '@core/terrain-generation/debug-utils';
import { verifyConnectivity } from '@core/terrain-generation/__tests__/helpers';

describe('Terrain Generation Integration Tests', () => {
  test('generates connected terrains reliably', () => {
    const seeds = [12345, 67890, 11111, 99999, 54321];

    seeds.forEach((seed) => {
      const result = generateRandomTerrain(20, 20, 0.3, seed);

      // Verify connectivity
      expect(verifyConnectivity(result.grid)).toBe(true);

      // Verify density is reasonable
      expect(result.actualDensity).toBeGreaterThan(0.2);
      expect(result.actualDensity).toBeLessThanOrEqual(0.3);
    });
  });

  test('achieves target obstacle density', () => {
    const result = generateRandomTerrain(30, 30, 0.25, 42);

    expect(result.actualDensity).toBeGreaterThan(0.2);
    expect(result.actualDensity).toBeLessThanOrEqual(0.25);
    expect(result.obstaclesPlaced).toBeGreaterThan(0);
  });

  test('deterministic generation with same seed', () => {
    const seed = 98765;
    const result1 = generateRandomTerrain(15, 15, 0.2, seed);
    const result2 = generateRandomTerrain(15, 15, 0.2, seed);

    // Should produce identical grids
    expect(result1.obstaclesPlaced).toBe(result2.obstaclesPlaced);
    expect(result1.actualDensity).toBe(result2.actualDensity);

    // Verify grid contents are identical
    const dims = result1.grid.getDimensions();
    for (let y = 0; y < dims.height; y++) {
      for (let x = 0; x < dims.width; x++) {
        const coord = { x, y };
        expect(result1.grid.getCell(coord)).toBe(result2.grid.getCell(coord));
      }
    }
  });

  test('handles various grid sizes', () => {
    const testCases = [
      { width: 10, height: 10, density: 0.2 },
      { width: 25, height: 25, density: 0.3 },
      { width: 50, height: 30, density: 0.25 },
    ];

    testCases.forEach(({ width, height, density }) => {
      const result = generateRandomTerrain(width, height, density, 123);

      expect(result.grid.getDimensions().width).toBe(width);
      expect(result.grid.getDimensions().height).toBe(height);
      expect(verifyConnectivity(result.grid)).toBe(true);
    });
  });

  test('handles edge cases gracefully', () => {
    // Very small grid
    const smallResult = generateRandomTerrain(5, 5, 0.2, 777);
    expect(verifyConnectivity(smallResult.grid)).toBe(true);

    // Very low density
    const lowDensityResult = generateRandomTerrain(20, 20, 0.05, 888);
    expect(verifyConnectivity(lowDensityResult.grid)).toBe(true);

    // Higher density (but within limits)
    const highDensityResult = generateRandomTerrain(20, 20, 0.4, 999);
    expect(verifyConnectivity(highDensityResult.grid)).toBe(true);
  });

  test('performance benchmarks', () => {
    // Test different grid sizes for performance
    const performanceTests = [
      { size: 20, expected: 20 }, // Should be very fast
      { size: 50, expected: 100 }, // Should be reasonably fast
      { size: 100, expected: 500 }, // More relaxed expectation for 100x100
    ];

    performanceTests.forEach(({ size, expected }) => {
      const { timeMs } = PerformanceProfiler.timeGeneration(() => {
        return generateRandomTerrain(size, size, 0.3, 456);
      });

      // Performance expectation - should be faster than expected time
      expect(timeMs).toBeLessThan(expected);
    });
  });

  test('separate components work independently', () => {
    // Test that generateTerrain and CandidateGenerator can be used independently
    const candidateGenerator = new RandomCandidateGenerator(654321, 15, 15);
    const result = generateTerrain(15, 15, 0.25, candidateGenerator);

    expect(verifyConnectivity(result.grid)).toBe(true);
    expect(result.actualDensity).toBeGreaterThan(0.15);
  });

  test('fails gracefully with impossible parameters', () => {
    // Test with very high density that might be hard to achieve
    const result = generateRandomTerrain(10, 10, 0.49, 111); // Just under MAX_DENSITY

    // Should either achieve the density or provide partial result
    expect(result.actualDensity).toBeGreaterThan(0);
    expect(result.grid).toBeDefined();
    expect(verifyConnectivity(result.grid)).toBe(true);
  });

  test('maintains connectivity invariant throughout generation', () => {
    // Use smaller grid to make debugging easier
    const result = generateRandomTerrain(12, 12, 0.3, 321);

    // Final result must be connected
    expect(verifyConnectivity(result.grid)).toBe(true);

    // Verify no isolated regions exist
    const dimensions = result.grid.getDimensions();
    let freeCount = 0;

    for (let y = 0; y < dimensions.height; y++) {
      for (let x = 0; x < dimensions.width; x++) {
        if (result.grid.getCell({ x, y }) === CellState.FREE) {
          freeCount++;
        }
      }
    }

    expect(freeCount).toBeGreaterThan(0);
    expect(result.obstaclesPlaced).toBeGreaterThan(0);
  });

  test('debug utilities work correctly', () => {
    const result = generateRandomTerrain(8, 6, 0.25, 789);

    // Test ASCII rendering
    const rendered = DebugRenderer.renderGrid(result.grid);
    expect(rendered).toContain('#'); // Should have obstacles
    expect(rendered).toContain('.'); // Should have free cells
    expect(rendered.split('\n').length).toBe(7); // 6 rows + 1 header

    // Test connectivity verification
    expect(verifyConnectivity(result.grid)).toBe(true);

    // Test coordinate rendering
    const coordRendered = DebugRenderer.renderGridWithCoords(result.grid);
    expect(coordRendered).toContain('|'); // Should have row separators
  });
});
