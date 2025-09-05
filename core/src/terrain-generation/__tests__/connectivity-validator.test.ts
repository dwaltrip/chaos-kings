import { ConnectivityValidator } from '../connectivity-validator';
import { Grid } from '../grid';
import { CellState } from '../types';

describe('ConnectivityValidator - Edge Cases', () => {
  let validator: ConnectivityValidator;

  beforeEach(() => {
    validator = new ConnectivityValidator();
  });

  test('allows obstacle in corner with one neighbor', () => {
    // 5x5 grid, try to place in corner (0,0)
    // Should always allow (only 1 neighbor)
    const grid = new Grid(5, 5);
    const result = validator.canPlaceObstacle(grid, { x: 0, y: 0 });
    expect(result).toBe(true);
  });

  test('prevents breaking a single corridor', () => {
    // Create grid with narrow passage:
    // . . # . .
    // . . . . .
    // . . # . .
    const grid = new Grid(5, 5);
    // Create narrow vertical corridor at x=2
    grid.setCell({ x: 2, y: 0 }, CellState.OBSTACLE);
    grid.setCell({ x: 2, y: 2 }, CellState.OBSTACLE);
    grid.setCell({ x: 2, y: 3 }, CellState.OBSTACLE);
    grid.setCell({ x: 2, y: 4 }, CellState.OBSTACLE);

    // Try to block the middle corridor cell - should reject
    const result = validator.canPlaceObstacle(grid, { x: 2, y: 1 });
    expect(result).toBe(false);
  });

  test('detects articulation point correctly', () => {
    // Create grid where one cell connects two regions:
    // . . . # #
    // # # . # #  <- Cell at (2,1) is articulation point
    // # # . . .
    const grid = new Grid(5, 5);

    // Set up obstacles to create articulation point scenario
    grid.setCell({ x: 3, y: 0 }, CellState.OBSTACLE);
    grid.setCell({ x: 4, y: 0 }, CellState.OBSTACLE);
    grid.setCell({ x: 0, y: 1 }, CellState.OBSTACLE);
    grid.setCell({ x: 1, y: 1 }, CellState.OBSTACLE);
    grid.setCell({ x: 3, y: 1 }, CellState.OBSTACLE);
    grid.setCell({ x: 4, y: 1 }, CellState.OBSTACLE);
    grid.setCell({ x: 0, y: 2 }, CellState.OBSTACLE);
    grid.setCell({ x: 1, y: 2 }, CellState.OBSTACLE);

    // Should reject placing obstacle at (2,1) - it's an articulation point
    const result = validator.canPlaceObstacle(grid, { x: 2, y: 1 });
    expect(result).toBe(false);
  });

  test("allows obstacle that doesn't break connectivity", () => {
    // Create grid with multiple paths:
    // . . . . .
    // . . . . .
    // . . . . .
    const grid = new Grid(5, 5);

    // Should allow - many alternate paths exist
    const result = validator.canPlaceObstacle(grid, { x: 2, y: 2 });
    expect(result).toBe(true);
  });

  test('handles edge placement correctly', () => {
    // Test placing obstacles along grid edges
    const grid = new Grid(5, 5);

    // Edge cells should generally be allowed unless they create isolation
    const edgeResult = validator.canPlaceObstacle(grid, { x: 0, y: 1 });
    expect(edgeResult).toBe(true);
  });

  test('handles single-cell dead end creation', () => {
    // . . . . .
    // . . # . .
    // . . . . .
    const grid = new Grid(5, 5);
    grid.setCell({ x: 2, y: 1 }, CellState.OBSTACLE);

    // Cell (2,0) is now a dead-end but still connected - should allow
    const result = validator.canPlaceObstacle(grid, { x: 1, y: 1 });
    expect(result).toBe(true);
  });

  test('handles grid with single free cell remaining', () => {
    // Edge case: only one free cell left
    const grid = new Grid(5, 5);
    // Fill most cells, leave just one free
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        if (!(x === 2 && y === 2)) {
          grid.setCell({ x, y }, CellState.OBSTACLE);
        }
      }
    }

    // Last cell has no free neighbors - should allow
    const result = validator.canPlaceObstacle(grid, { x: 2, y: 2 });
    expect(result).toBe(true);
  });

  test('rejects placement that would isolate corner region', () => {
    // Create scenario where blocking would isolate regions
    // Create a narrow passage that would be completely blocked
    const grid = new Grid(5, 5);

    // Create walls to form a narrow corridor
    for (let y = 0; y < 5; y++) {
      grid.setCell({ x: 1, y }, CellState.OBSTACLE);
      grid.setCell({ x: 3, y }, CellState.OBSTACLE);
    }
    // Leave gaps at y=1 and y=2 to create a corridor
    grid.setCell({ x: 1, y: 1 }, CellState.FREE);
    grid.setCell({ x: 1, y: 2 }, CellState.FREE);
    grid.setCell({ x: 3, y: 1 }, CellState.FREE);
    grid.setCell({ x: 3, y: 2 }, CellState.FREE);

    // Now create a single-cell bottleneck at (2,1)
    // Blocking (2,2) should disconnect the grid
    const result = validator.canPlaceObstacle(grid, { x: 2, y: 2 });
    expect(result).toBe(false);
  });
});

describe('BFS Validator - Core Behavior', () => {
  let validator: ConnectivityValidator;

  beforeEach(() => {
    validator = new ConnectivityValidator();
  });

  test('handles no neighbors case', () => {
    // Cell with no free neighbors should always be allowed
    const grid = new Grid(5, 5);
    // Fill all neighbors of center cell
    grid.setCell({ x: 1, y: 2 }, CellState.OBSTACLE);
    grid.setCell({ x: 3, y: 2 }, CellState.OBSTACLE);
    grid.setCell({ x: 2, y: 1 }, CellState.OBSTACLE);
    grid.setCell({ x: 2, y: 3 }, CellState.OBSTACLE);

    const result = validator.canPlaceObstacle(grid, { x: 2, y: 2 });
    expect(result).toBe(true);
  });

  test('handles single neighbor case', () => {
    // Cell with one free neighbor should always be allowed
    const grid = new Grid(5, 5);
    // Fill 3 out of 4 neighbors
    grid.setCell({ x: 1, y: 2 }, CellState.OBSTACLE);
    grid.setCell({ x: 3, y: 2 }, CellState.OBSTACLE);
    grid.setCell({ x: 2, y: 1 }, CellState.OBSTACLE);
    // Leave (2,3) free

    const result = validator.canPlaceObstacle(grid, { x: 2, y: 2 });
    expect(result).toBe(true);
  });

  test('validates multiple neighbors connectivity', () => {
    // Simple case: center cell with 4 free neighbors
    const grid = new Grid(5, 5);

    // All neighbors are free and can reach each other
    const result = validator.canPlaceObstacle(grid, { x: 2, y: 2 });
    expect(result).toBe(true);
  });
});
