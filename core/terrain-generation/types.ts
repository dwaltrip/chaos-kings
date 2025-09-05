export enum CellState {
  FREE = 0,
  OBSTACLE = 1,
}

export interface Coord {
  x: number;
  y: number;
}

export interface GridDimensions {
  width: number;
  height: number;
}
