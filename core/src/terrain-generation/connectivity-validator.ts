import { Coord } from './types';
import { BFSValidator } from './bfs-validator';
import { Grid } from './grid';

export class ConnectivityValidator {
  private bfsValidator: BFSValidator;

  constructor() {
    this.bfsValidator = new BFSValidator();
  }

  /**
   * Determines if placing an obstacle at pos would maintain connectivity.
   * Uses local validation - checks if neighbors remain connected to each other.
   */
  canPlaceObstacle(grid: Grid, pos: Coord): boolean {
    const freeNeighbors = grid.getFreeNeighbors(pos);

    if (freeNeighbors.length <= 1) {
      return true;
    }

    const [firstNeighbor, ...remainingNeighbors] = freeNeighbors;

    const reachableTargets = this.bfsValidator.findReachableTargets(
      grid,
      firstNeighbor,
      remainingNeighbors,
      pos,
    );

    return reachableTargets.size === remainingNeighbors.length;
  }
}
