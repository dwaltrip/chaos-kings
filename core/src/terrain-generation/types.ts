const CellState = {
  FREE: 0,
  OBSTACLE: 1,
} as const;

type CellState = (typeof CellState)[keyof typeof CellState];

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
