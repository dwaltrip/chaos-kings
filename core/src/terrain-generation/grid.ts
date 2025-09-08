import {
  CellState,
  Coord,
  GridDimensions,
} from '@core/terrain-generation/types';
import {
  MIN_GRID_SIZE,
  MAX_GRID_SIZE,
} from '@core/terrain-generation/constants';

class Grid {
  private cells: CellState[][];
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    if (width < MIN_GRID_SIZE || width > MAX_GRID_SIZE) {
      throw new Error(
        `Grid width must be between ${MIN_GRID_SIZE} and ${MAX_GRID_SIZE}`,
      );
    }
    if (height < MIN_GRID_SIZE || height > MAX_GRID_SIZE) {
      throw new Error(
        `Grid height must be between ${MIN_GRID_SIZE} and ${MAX_GRID_SIZE}`,
      );
    }

    this.width = width;
    this.height = height;
    this.cells = Array(height)
      .fill(null)
      .map(() => Array(width).fill(CellState.FREE));
  }

  isValidCoord(pos: Coord): boolean {
    return (
      pos.x >= 0 && pos.x < this.width && pos.y >= 0 && pos.y < this.height
    );
  }

  getCell(pos: Coord): CellState {
    if (!this.isValidCoord(pos)) {
      throw new Error(`Invalid coordinate: (${pos.x}, ${pos.y})`);
    }
    return this.cells[pos.y][pos.x];
  }

  setCell(pos: Coord, state: CellState): void {
    if (!this.isValidCoord(pos)) {
      throw new Error(`Invalid coordinate: (${pos.x}, ${pos.y})`);
    }
    this.cells[pos.y][pos.x] = state;
  }

  getNeighbors(pos: Coord): Coord[] {
    if (!this.isValidCoord(pos)) {
      throw new Error(`Invalid coordinate: (${pos.x}, ${pos.y})`);
    }

    const neighbors: Coord[] = [];
    const directions = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ];

    for (const dir of directions) {
      const neighbor = { x: pos.x + dir.x, y: pos.y + dir.y };
      if (this.isValidCoord(neighbor)) {
        neighbors.push(neighbor);
      }
    }

    return neighbors;
  }

  getFreeNeighbors(pos: Coord): Coord[] {
    return this.getNeighbors(pos).filter(
      (neighbor) => this.getCell(neighbor) === CellState.FREE,
    );
  }

  getEightDirectionalNeighbors(pos: Coord): Coord[] {
    if (!this.isValidCoord(pos)) {
      throw new Error(`Invalid coordinate: (${pos.x}, ${pos.y})`);
    }

    const neighbors: Coord[] = [];
    const directions = [
      { x: -1, y: -1 }, // top-left
      { x: 0, y: -1 }, // top
      { x: 1, y: -1 }, // top-right
      { x: -1, y: 0 }, // left
      { x: 1, y: 0 }, // right
      { x: -1, y: 1 }, // bottom-left
      { x: 0, y: 1 }, // bottom
      { x: 1, y: 1 }, // bottom-right
    ];

    for (const dir of directions) {
      const neighbor = { x: pos.x + dir.x, y: pos.y + dir.y };
      if (this.isValidCoord(neighbor)) {
        neighbors.push(neighbor);
      }
    }

    return neighbors;
  }

  getDimensions(): GridDimensions {
    return { width: this.width, height: this.height };
  }

  isEmpty(): boolean {
    return this.getObstacleCount() === 0;
  }

  getObstacleCount(): number {
    let count = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.cells[y][x] === CellState.OBSTACLE) {
          count++;
        }
      }
    }
    return count;
  }

  getObstacleDensity(): number {
    const totalCells = this.width * this.height;
    return this.getObstacleCount() / totalCells;
  }
}

const coordToString = (c: Coord): string => `${c.x},${c.y}`;

const stringToCoord = (s: string): Coord => {
  const [x, y] = s.split(',').map(Number);
  return { x, y };
};

export {
  CellState,
  type Coord,
  type GridDimensions,
} from '@core/terrain-generation/types';

export { Grid, coordToString, stringToCoord };
