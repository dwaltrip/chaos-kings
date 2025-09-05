import { Grid } from './grid';
import { CellState, Coord } from './types';
import { BFSValidator } from './bfs-validator';

export class DebugRenderer {
  /**
   * Renders grid as ASCII representation for debugging
   * '#' = obstacle, '.' = free
   */
  static renderGrid(grid: Grid): string {
    const dimensions = grid.getDimensions();
    const lines: string[] = [];

    // Add column headers
    const colHeader =
      '  ' +
      Array.from({ length: dimensions.width }, (_, i) =>
        (i % 10).toString(),
      ).join('');
    lines.push(colHeader);

    // Add rows with row numbers
    for (let y = 0; y < dimensions.height; y++) {
      const rowNum = (y % 10).toString();
      let row = rowNum + ' ';

      for (let x = 0; x < dimensions.width; x++) {
        const cell = grid.getCell({ x, y });
        row += cell === CellState.OBSTACLE ? '#' : '.';
      }

      lines.push(row);
    }

    return lines.join('\n');
  }

  /**
   * Full BFS connectivity check for validation
   * Returns true if all free cells are connected
   */
  static verifyConnectivity(grid: Grid): boolean {
    const dimensions = grid.getDimensions();

    // Find first free cell to start from
    let startCell: Coord | null = null;
    const allFreeCells: Coord[] = [];

    for (let y = 0; y < dimensions.height; y++) {
      for (let x = 0; x < dimensions.width; x++) {
        const coord = { x, y };
        if (grid.getCell(coord) === CellState.FREE) {
          allFreeCells.push(coord);
          if (!startCell) {
            startCell = coord;
          }
        }
      }
    }

    // If no free cells or only one free cell, connectivity is trivial
    if (allFreeCells.length <= 1) {
      return true;
    }

    if (!startCell) {
      return true; // No free cells
    }

    // BFS from start cell to see how many cells we can reach
    const visited = new Set<string>();
    const queue: Coord[] = [startCell];
    visited.add(`${startCell.x},${startCell.y}`);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = grid.getNeighbors(current);

      for (const neighbor of neighbors) {
        const key = `${neighbor.x},${neighbor.y}`;
        if (!visited.has(key) && grid.getCell(neighbor) === CellState.FREE) {
          visited.add(key);
          queue.push(neighbor);
        }
      }
    }

    // Check if we reached all free cells
    return visited.size === allFreeCells.length;
  }

  /**
   * Renders grid with coordinate labels for easier debugging
   */
  static renderGridWithCoords(grid: Grid): string {
    const dimensions = grid.getDimensions();
    const lines: string[] = [];

    // Add detailed column headers
    if (dimensions.width > 10) {
      const tensLine =
        '   ' +
        Array.from({ length: dimensions.width }, (_, i) =>
          Math.floor(i / 10).toString(),
        ).join('');
      lines.push(tensLine);
    }

    const onesLine =
      '   ' +
      Array.from({ length: dimensions.width }, (_, i) =>
        (i % 10).toString(),
      ).join('');
    lines.push(onesLine);

    // Add separator
    lines.push('   ' + '-'.repeat(dimensions.width));

    // Add rows with detailed row numbers
    for (let y = 0; y < dimensions.height; y++) {
      const rowNum = y.toString().padStart(2, '0');
      let row = rowNum + '|';

      for (let x = 0; x < dimensions.width; x++) {
        const cell = grid.getCell({ x, y });
        row += cell === CellState.OBSTACLE ? '#' : '.';
      }

      lines.push(row);
    }

    return lines.join('\n');
  }

  /**
   * Highlights specific cells in the grid rendering
   */
  static renderGridWithHighlight(
    grid: Grid,
    highlights: { coord: Coord; char: string }[],
  ): string {
    const dimensions = grid.getDimensions();
    const highlightMap = new Map<string, string>();

    // Build highlight map
    highlights.forEach(({ coord, char }) => {
      highlightMap.set(`${coord.x},${coord.y}`, char);
    });

    const lines: string[] = [];

    // Add column headers
    const colHeader =
      '  ' +
      Array.from({ length: dimensions.width }, (_, i) =>
        (i % 10).toString(),
      ).join('');
    lines.push(colHeader);

    // Add rows
    for (let y = 0; y < dimensions.height; y++) {
      const rowNum = (y % 10).toString();
      let row = rowNum + ' ';

      for (let x = 0; x < dimensions.width; x++) {
        const key = `${x},${y}`;
        if (highlightMap.has(key)) {
          row += highlightMap.get(key)!;
        } else {
          const cell = grid.getCell({ x, y });
          row += cell === CellState.OBSTACLE ? '#' : '.';
        }
      }

      lines.push(row);
    }

    return lines.join('\n');
  }
}

export class PerformanceProfiler {
  /**
   * Simple timing wrapper for performance validation
   */
  static timeGeneration<T>(generationFn: () => T): {
    result: T;
    timeMs: number;
  } {
    const startTime = performance.now();
    const result = generationFn();
    const endTime = performance.now();

    return {
      result,
      timeMs: endTime - startTime,
    };
  }

  /**
   * Profile multiple generation runs and return statistics
   */
  static profileMultipleRuns<T>(
    generationFn: () => T,
    iterations: number = 10,
  ): {
    results: T[];
    avgTimeMs: number;
    minTimeMs: number;
    maxTimeMs: number;
    totalTimeMs: number;
  } {
    const results: T[] = [];
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const { result, timeMs } = this.timeGeneration(generationFn);
      results.push(result);
      times.push(timeMs);
    }

    const totalTimeMs = times.reduce((sum, time) => sum + time, 0);

    return {
      results,
      avgTimeMs: totalTimeMs / iterations,
      minTimeMs: Math.min(...times),
      maxTimeMs: Math.max(...times),
      totalTimeMs,
    };
  }
}

export class ValidationHelper {
  private bfsValidator = new BFSValidator();

  /**
   * Test BFS validator directly with custom scenarios
   */
  testBFSReachability(
    grid: Grid,
    start: Coord,
    targets: Coord[],
    avoid: Coord,
  ): {
    reachableTargets: Set<string>;
    unreachableCount: number;
    allReachable: boolean;
  } {
    const reachableTargets = this.bfsValidator.findReachableTargets(
      grid,
      start,
      targets,
      avoid,
    );

    const unreachableCount = targets.length - reachableTargets.size;
    const allReachable = unreachableCount === 0;

    return {
      reachableTargets,
      unreachableCount,
      allReachable,
    };
  }

  /**
   * Create simple test grids for debugging
   */
  static createTestGrid(pattern: string[]): Grid {
    const height = pattern.length;
    const width = pattern[0]?.length || 0;

    if (width === 0) {
      throw new Error('Empty pattern provided');
    }

    const grid = new Grid(width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (x >= pattern[y].length) {
          continue;
        }

        const char = pattern[y][x];
        if (char === '#') {
          grid.setCell({ x, y }, CellState.OBSTACLE);
        }
        // '.' or any other character defaults to FREE
      }
    }

    return grid;
  }
}
