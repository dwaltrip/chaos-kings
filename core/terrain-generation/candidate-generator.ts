import { Coord } from './types';
import { Grid } from './grid';

export interface CandidateGenerator {
  next(grid: Grid): Coord;
}

class SeededRNG {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646; // [0, 1)
  }
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

  next(grid: Grid): Coord {
    const x = Math.floor(this.rng.next() * this.gridWidth);
    const y = Math.floor(this.rng.next() * this.gridHeight);
    return { x, y };
  }
}
