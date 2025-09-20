import { type Coord, CellState } from '@core/terrain-generation/types';
import { Grid, coordToString } from '@core/terrain-generation/grid';

// Finds which target coordinates are reachable from start,
// avoiding a specific coordinate.
// Uses early termination - stops when all targets found.
const BFS = {
  findReachableTargets(
    grid: Grid,
    start: Coord,
    targets: Coord[],
    avoid: Coord,
  ): Set<string> {
    if (targets.length === 0) {
      return new Set<string>();
    }

    const visited = new Set<string>();
    const queue: Coord[] = [start];
    const targetStrings = new Set(targets.map(coordToString));
    const reachableTargets = new Set<string>();
    const avoidString = coordToString(avoid);

    visited.add(coordToString(start));

    if (targetStrings.has(coordToString(start))) {
      reachableTargets.add(coordToString(start));
    }

    while (queue.length > 0 && reachableTargets.size < targets.length) {
      const current = queue.shift()!;

      const neighbors = grid.getNeighbors(current);
      for (const neighbor of neighbors) {
        const neighborString = coordToString(neighbor);

        if (visited.has(neighborString) || neighborString === avoidString) {
          continue;
        }

        if (grid.getCell(neighbor) !== CellState.FREE) {
          continue;
        }

        visited.add(neighborString);
        queue.push(neighbor);

        if (targetStrings.has(neighborString)) {
          reachableTargets.add(neighborString);

          if (reachableTargets.size === targets.length) {
            break;
          }
        }
      }
    }

    return reachableTargets;
  },
};

export { BFS };
