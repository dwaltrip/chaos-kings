import { Grid } from '@core/terrain-generation/grid';
import { CellState, Coord } from '@core/terrain-generation/types';

// Full BFS connectivity check for validation
// Returns true if all free cells are connected
function verifyConnectivity(grid: Grid): boolean {
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

export { verifyConnectivity };
