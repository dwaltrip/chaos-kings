// --------------------------------------------------------------------------
// TODO: rename this file or something.
// It's not obvious that this is the main entry point for terrain-generation
// --------------------------------------------------------------------------
import type { GameGrid, Size2d, PlayerSquare, Coord } from '@core/types';
import { SquareType } from '@core/types';
import { generateTerrainWithCandidates } from '@core/terrain-generation/generate-terrain';
import { MountainCandidateGenerator } from '@core/terrain-generation/mountain-candidate-generator';
import { convertToGameGrid } from '@core/terrain-generation/game-grid-converter';

interface GameMapResult {
  grid: GameGrid;
  generals: PlayerSquare[];
}

interface MapGenerationParams {
  size: Size2d;
  numPlayers: number;
  minGeneralDistance: number;
  seed: number;
  // NOTE: Unused. But in future, can use to replicate old map behavior
  algoVersion?: string;
}

function generateGameMapV2(
  { size, numPlayers, minGeneralDistance, seed }: MapGenerationParams,
  warnOnFailure: boolean = false,
): GameMapResult {
  // Generate terrain using v2 system with mountain clustering
  // V2 ConnectivityValidator ensures connectivity during generation
  const mountainGenerator = new MountainCandidateGenerator(
    seed,
    size.width,
    size.height,
  );

  const terrainResult = generateTerrainWithCandidates(
    size.width,
    size.height,
    mountainGenerator,
    { warnOnFailure },
  );

  // Convert to GameGrid format
  const { grid } = convertToGameGrid(terrainResult.grid);

  // Place generals with distance constraints
  const generals = addGeneralsWithDistanceConstraint(
    grid,
    numPlayers,
    minGeneralDistance,
    // TODO: do we actually want a different seed here?
    seed + 1000, // Different seed for general placement
  );

  return { grid, generals };
}

// General placement logic from original system
function addGeneralsWithDistanceConstraint(
  grid: GameGrid,
  count: number,
  minDistance: number,
  seed: number,
): PlayerSquare[] {
  const generals: PlayerSquare[] = [];
  const maxAttempts = 1000;

  // Simple seeded random for general placement
  let rngSeed = seed;
  const seededRandom = () => {
    rngSeed = (rngSeed * 16807) % 2147483647;
    return (rngSeed - 1) / 2147483646;
  };

  const randCoord = (): Coord => ({
    x: Math.floor(seededRandom() * grid[0].length),
    y: Math.floor(seededRandom() * grid.length),
  });

  for (let i = 0; i < count; i++) {
    let coord = randCoord();
    let attempts = 0;

    while (attempts < maxAttempts) {
      if (
        grid[coord.y][coord.x].type === SquareType.BLANK &&
        isFarEnoughFromOtherGenerals(coord, generals, minDistance)
      ) {
        break;
      }
      coord = randCoord();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error(
        `Failed to place general ${i + 1} after ${maxAttempts} attempts. ` +
          `Try reducing minDistance or increasing map size.`,
      );
    }

    const generalSquare: PlayerSquare = {
      coord,
      type: SquareType.GENERAL,
      playerIndex: i,
      units: 1,
    };

    grid[coord.y][coord.x] = generalSquare;
    generals.push(generalSquare);
  }

  return generals;
}

// Helper functions for general placement
function manhattanDistance(coord1: Coord, coord2: Coord): number {
  return Math.abs(coord1.x - coord2.x) + Math.abs(coord1.y - coord2.y);
}

function isFarEnoughFromOtherGenerals(
  coord: Coord,
  existingGenerals: PlayerSquare[],
  minDistance: number,
): boolean {
  return existingGenerals.every(
    (general) => manhattanDistance(coord, general.coord) >= minDistance,
  );
}

export type { GameMapResult, MapGenerationParams };
export { generateGameMapV2 };
