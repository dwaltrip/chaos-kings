import { CellState } from './types';
import { Grid } from './grid';
import { ConnectivityValidator } from './connectivity-validator';
import { CandidateGenerator } from './candidate-generator';
import {
  MAX_DENSITY,
  MAX_TOTAL_FAILURES,
  MIN_GRID_SIZE,
  MAX_GRID_SIZE,
} from './constants';

export interface GenerationOptions {
  warnOnFailure?: boolean;
}

export interface GenerationResult {
  grid: Grid;
  actualDensity: number;
  targetDensity: number;
  obstaclesPlaced: number;
  attemptsReached: boolean;
}

export class TerrainGenerator {
  private connectivityValidator: ConnectivityValidator;

  constructor() {
    this.connectivityValidator = new ConnectivityValidator();
  }

  generateTerrain(
    width: number,
    height: number,
    targetDensity: number,
    candidateGenerator: CandidateGenerator,
    options: GenerationOptions = {},
  ): GenerationResult {
    this.validateParameters(width, height, targetDensity);

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

      if (grid.getCell(candidate) === CellState.OBSTACLE) {
        totalFailures++;
        continue;
      }

      if (this.connectivityValidator.canPlaceObstacle(grid, candidate)) {
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

  private validateParameters(
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
}
