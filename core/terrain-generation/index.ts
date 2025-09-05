export type { CellState, Coord, GridDimensions } from './types';
export { Grid } from './grid';
export type { CandidateGenerator } from './candidate-generator';
export { RandomCandidateGenerator } from './candidate-generator';
export type { GenerationOptions, GenerationResult } from './terrain-generator';
export { TerrainGenerator } from './terrain-generator';
export { ConnectivityValidator } from './connectivity-validator';
export { BFSValidator } from './bfs-validator';

import { TerrainGenerator, GenerationResult } from './terrain-generator';
import { RandomCandidateGenerator } from './candidate-generator';

/**
 * Convenience factory function for generating random terrain
 */
export function generateRandomTerrain(
  width: number,
  height: number,
  density: number,
  seed: number,
): GenerationResult {
  const generator = new TerrainGenerator();
  const candidateGenerator = new RandomCandidateGenerator(seed, width, height);
  return generator.generateTerrain(width, height, density, candidateGenerator);
}
