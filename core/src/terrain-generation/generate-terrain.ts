import { CellState } from '@core/terrain-generation/types';
import { Grid } from '@core/terrain-generation/grid';
import { canPlaceObstacle } from '@core/terrain-generation/connectivity';
import { CandidateGenerator } from '@core/terrain-generation/candidate-generator';
import {
  MAX_DENSITY,
  MAX_TOTAL_FAILURES,
  MAX_GLOBAL_ATTEMPTS,
  MIN_GRID_SIZE,
  MAX_GRID_SIZE,
} from '@core/terrain-generation/constants';

interface GenerationOptions {
  warnOnFailure?: boolean;
}

interface GenerationResult {
  grid: Grid;
  actualDensity: number;
  targetDensity: number;
  obstaclesPlaced: number;
  attemptsReached: boolean;
}

function generateTerrain(
  width: number,
  height: number,
  targetDensity: number,
  candidateGenerator: CandidateGenerator,
  options: GenerationOptions = {},
): GenerationResult {
  validateParameters(width, height, targetDensity);

  const grid = new Grid(width, height);
  const targetObstacles = Math.floor(width * height * targetDensity);

  let obstaclesPlaced = 0;
  let totalFailures = 0;
  let attemptsReached = false;

  while (
    obstaclesPlaced < targetObstacles &&
    totalFailures < MAX_TOTAL_FAILURES
  ) {
    const candidate = candidateGenerator.next(grid);

    // Handle null return from candidate generator (for backward compatibility)
    if (candidate === null) {
      break;
    }

    if (grid.getCell(candidate) === CellState.OBSTACLE) {
      totalFailures++;
      continue;
    }

    if (canPlaceObstacle(grid, candidate)) {
      grid.setCell(candidate, CellState.OBSTACLE);
      obstaclesPlaced++;
      totalFailures = 0;
    } else {
      totalFailures++;
    }
  }

  if (totalFailures >= MAX_TOTAL_FAILURES) {
    attemptsReached = true;
    if (options.warnOnFailure !== false) {
      console.warn(
        `Terrain generation stopped after ${MAX_TOTAL_FAILURES} failures. ` +
          `Achieved density: ${grid.getObstacleDensity().toFixed(3)} (target: ${targetDensity.toFixed(3)})`,
      );
    }
  }

  return {
    grid,
    actualDensity: grid.getObstacleDensity(),
    targetDensity,
    obstaclesPlaced,
    attemptsReached,
  };
}

function generateTerrainWithCandidates(
  width: number,
  height: number,
  candidateGenerator: CandidateGenerator,
  options: GenerationOptions = {},
): GenerationResult {
  validateParameters(width, height, 0.5); // Use max density for validation

  const grid = new Grid(width, height);
  let obstaclesPlaced = 0;
  let totalAttempts = 0;
  let attemptsReached = false;

  let candidate;
  while (
    (candidate = candidateGenerator.next(grid)) !== null &&
    totalAttempts < MAX_GLOBAL_ATTEMPTS
  ) {
    if (canPlaceObstacle(grid, candidate)) {
      grid.setCell(candidate, CellState.OBSTACLE);
      obstaclesPlaced++;
    }
    totalAttempts++;
  }

  if (totalAttempts >= MAX_GLOBAL_ATTEMPTS) {
    attemptsReached = true;
    if (options.warnOnFailure !== false) {
      console.warn(
        `Candidate-controlled terrain generation stopped after ${MAX_GLOBAL_ATTEMPTS} attempts. ` +
          `Achieved density: ${grid.getObstacleDensity().toFixed(3)}`,
      );
    }
  }

  return {
    grid,
    actualDensity: grid.getObstacleDensity(),
    targetDensity: grid.getObstacleDensity(), // For candidate-controlled, actual is the target
    obstaclesPlaced,
    attemptsReached,
  };
}

function validateParameters(
  width: number,
  height: number,
  targetDensity: number,
): void {
  if (width < MIN_GRID_SIZE || width > MAX_GRID_SIZE) {
    throw new Error(
      `Width must be between ${MIN_GRID_SIZE} and ${MAX_GRID_SIZE}`,
    );
  }

  if (height < MIN_GRID_SIZE || height > MAX_GRID_SIZE) {
    throw new Error(
      `Height must be between ${MIN_GRID_SIZE} and ${MAX_GRID_SIZE}`,
    );
  }

  if (targetDensity <= 0 || targetDensity > MAX_DENSITY) {
    throw new Error(`Target density must be between 0 and ${MAX_DENSITY}`);
  }
}

export type { GenerationOptions, GenerationResult };
export { generateTerrain, generateTerrainWithCandidates };
