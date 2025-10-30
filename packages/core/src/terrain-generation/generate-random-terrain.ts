import {
  type GenerationResult,
  generateTerrain,
} from '@core/terrain-generation/generate-terrain';
import { RandomCandidateGenerator } from '@core/terrain-generation/candidate-generator';

// Convenience factory function for generating random terrain
function generateRandomTerrain(
  width: number,
  height: number,
  density: number,
  seed: number,
): GenerationResult {
  const candidateGenerator = new RandomCandidateGenerator(seed, width, height);
  return generateTerrain(width, height, density, candidateGenerator);
}

export { generateRandomTerrain };
