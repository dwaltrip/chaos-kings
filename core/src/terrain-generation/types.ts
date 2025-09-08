enum CellState {
  FREE = 0,
  OBSTACLE = 1,
}

interface Coord {
  x: number;
  y: number;
}

interface GridDimensions {
  width: number;
  height: number;
}

export type { Coord, GridDimensions };
export { CellState };
