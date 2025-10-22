import type { Coord } from '@core/terrain-generation/types';
import type { Grid } from '@core/terrain-generation/grid';
import { BFS } from '@core/terrain-generation/bfs';

// Determines if placing an obstacle at pos would maintain connectivity.
// If the grid is currently connected, then we only need to check
// that the neighbors of pos remain connected to each other.
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
