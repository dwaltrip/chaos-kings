import { Grid } from '@core/terrain-generation/grid';
import { CellState, Coord } from '@core/terrain-generation/types';

class DebugRenderer {
  // Renders grid as ASCII representation for debugging
  // '#' = obstacle, '.' = free
  static renderGrid(grid: Grid): string {
    const dimensions = grid.getDimensions();
    const lines: string[] = [];

    // Add column headers
    const colHeader =
      '  ' +
      Array.from({ length: dimensions.width }, (_, i) => (i % 10).toString()).join('');
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

  // Renders grid with coordinate labels for easier debugging
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
      Array.from({ length: dimensions.width }, (_, i) => (i % 10).toString()).join('');
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
}

class PerformanceProfiler {
  // Simple timing wrapper for performance validation
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

  // Profile multiple generation runs and return statistics
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

export { DebugRenderer, PerformanceProfiler };
