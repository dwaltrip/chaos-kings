import { Coord } from './types';
import { Grid } from './grid';
import { SeededRNG } from './seeded-rng';

export interface CandidateGenerator {
  next(grid: Grid): Coord | null;
}

export class RandomCandidateGenerator implements CandidateGenerator {
  private rng: SeededRNG;
  private gridWidth: number;
  private gridHeight: number;

  constructor(seed: number, width: number, height: number) {
    this.rng = new SeededRNG(seed);
    this.gridWidth = width;
    this.gridHeight = height;
  }

  next(grid: Grid): Coord | null {
    const x = Math.floor(this.rng.next() * this.gridWidth);
    const y = Math.floor(this.rng.next() * this.gridHeight);
    return { x, y };
  }
}
