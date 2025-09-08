import { Coord } from './types';
import { BFS } from './bfs';
import { Grid } from './grid';

// Determines if placing an obstacle at pos would maintain connectivity.
// Uses local validation - checks if neighbors remain connected to each other.
function canPlaceObstacle(grid: Grid, pos: Coord): boolean {
  const freeNeighbors = grid.getFreeNeighbors(pos);

  if (freeNeighbors.length <= 1) {
    return true;
  }

  const [firstNeighbor, ...remainingNeighbors] = freeNeighbors;

  const reachableTargets = BFS.findReachableTargets(
    grid,
    firstNeighbor,
    remainingNeighbors,
    pos,
  );

  return reachableTargets.size === remainingNeighbors.length;
}

export { canPlaceObstacle };
