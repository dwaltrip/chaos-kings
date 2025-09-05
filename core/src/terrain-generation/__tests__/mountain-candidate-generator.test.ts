import { MountainCandidateGenerator } from '../mountain-candidate-generator';
import { Grid } from '../grid';
import { CellState } from '../types';

describe('MountainCandidateGenerator', () => {
  it('should generate mountains systematically across the grid', () => {
    const generator = new MountainCandidateGenerator(42, 5, 5);
    const grid = new Grid(5, 5);

    const candidates: Array<{ x: number; y: number }> = [];
    let candidate;

    // Collect all candidates generated
    while ((candidate = generator.next(grid)) !== null) {
      candidates.push(candidate);
      // Place the obstacle so next iterations can consider it
      grid.setCell(candidate, CellState.OBSTACLE);
    }

    // Should have generated some mountains
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThan(25); // Should not fill the entire grid

    // All candidates should be valid coordinates
    for (const coord of candidates) {
      expect(coord.x).toBeGreaterThanOrEqual(0);
      expect(coord.x).toBeLessThan(5);
      expect(coord.y).toBeGreaterThanOrEqual(0);
      expect(coord.y).toBeLessThan(5);
    }
  });

  it('should be deterministic with same seed', () => {
    const generator1 = new MountainCandidateGenerator(123, 5, 5);
    const generator2 = new MountainCandidateGenerator(123, 5, 5);

    const grid1 = new Grid(5, 5);
    const grid2 = new Grid(5, 5);

    const candidates1: Array<{ x: number; y: number }> = [];
    const candidates2: Array<{ x: number; y: number }> = [];

    let candidate1, candidate2;

    while (
      (candidate1 = generator1.next(grid1)) !== null ||
      (candidate2 = generator2.next(grid2)) !== null
    ) {
      if (candidate1) {
        candidates1.push(candidate1);
        grid1.setCell(candidate1, CellState.OBSTACLE);
      }
      if (candidate2) {
        candidates2.push(candidate2);
        grid2.setCell(candidate2, CellState.OBSTACLE);
      }
    }

    expect(candidates1).toEqual(candidates2);
  });

  it('should terminate by returning null when complete', () => {
    const generator = new MountainCandidateGenerator(999, 5, 5);
    const grid = new Grid(5, 5);

    let iterations = 0;
    let candidate;

    while ((candidate = generator.next(grid)) !== null) {
      if (candidate) {
        grid.setCell(candidate, CellState.OBSTACLE);
      }
      iterations++;

      // Safety check to prevent infinite loops in test
      expect(iterations).toBeLessThan(100);
    }

    // Should have terminated naturally
    expect(candidate).toBeNull();

    // Additional calls should continue returning null
    expect(generator.next(grid)).toBeNull();
    expect(generator.next(grid)).toBeNull();
  });
});
