import { generateTerrain, GenerationResult } from './generate-terrain';
import { RandomCandidateGenerator } from './candidate-generator';

// Convenience factory function for generating random terrain
export function generateRandomTerrain(
  width: number,
  height: number,
  density: number,
  seed: number,
): GenerationResult {
  const candidateGenerator = new RandomCandidateGenerator(seed, width, height);
  return generateTerrain(width, height, density, candidateGenerator);
}
