import { Coord, CellState } from '@core/terrain-generation/types';
import { Grid } from '@core/terrain-generation/grid';
import { CandidateGenerator } from '@core/terrain-generation/candidate-generator';
import { SeededRNG } from '@core/terrain-generation/seeded-rng';

interface MountainGenerationOptions {
  defaultProbability?: number;
  probabilityMap?: Map<number, number>;
}

class MountainCandidateGenerator implements CandidateGenerator {
  private rng: SeededRNG;
  private gridWidth: number;
  private gridHeight: number;
  private currentX: number = 0;
  private currentY: number = 0;
  private probabilityMap: Map<number, number>;
  private defaultProbability: number;
  private finished: boolean = false;

  constructor(
    seed: number,
    width: number,
    height: number,
    options: MountainGenerationOptions = {},
  ) {
    this.rng = new SeededRNG(seed);
    this.gridWidth = width;
    this.gridHeight = height;
    this.defaultProbability = options.defaultProbability || 0.1;

    // Default probability mapping from original mountainOrBlank function
    this.probabilityMap =
      options.probabilityMap ||
      new Map([
        [1, 0.35], // 1 nearby mountain: 35% chance
        [2, 0.35], // 2 nearby mountains: 35% chance
        [3, 0.05], // 3 nearby mountains: 5% chance
        // 0 or 4+ nearby mountains: use default (10%)
      ]);
  }

  next(grid: Grid): Coord | null {
    if (this.finished) {
      return null;
    }

    // Find next cell that should have a mountain placed
    while (this.currentY < this.gridHeight) {
      while (this.currentX < this.gridWidth) {
        const coord = { x: this.currentX, y: this.currentY };

        // Count nearby mountains using 8-directional neighbors
        const nearbyMountains = this.countNearbyMountains(grid, coord);

        // Get probability based on nearby mountain count
        const mountainProbability =
          this.probabilityMap.get(nearbyMountains) || this.defaultProbability;

        // Make probability decision
        const shouldPlaceMountain = this.rng.next() < mountainProbability;

        // Move to next cell
        this.currentX++;

        // If this cell should have a mountain, return its coordinate
        if (shouldPlaceMountain) {
          return coord;
        }
      }

      // Move to next row
      this.currentX = 0;
      this.currentY++;
    }

    // All cells processed
    this.finished = true;
    return null;
  }

  private countNearbyMountains(grid: Grid, pos: Coord): number {
    const neighbors = grid.getEightDirectionalNeighbors(pos);
    let count = 0;

    for (const neighbor of neighbors) {
      if (grid.getCell(neighbor) === CellState.OBSTACLE) {
        count++;
      }
    }

    return count;
  }
}

export type { MountainGenerationOptions };
export { MountainCandidateGenerator };
