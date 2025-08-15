import { Board } from '@core/board';
import { isBlankSquare, isNeutralSquare } from '@core/square';
import {
  SquareType,
  Square,
  GameGrid,
  Coord,
  Size2d,
  PlayerSquare,
} from '@core/types';
import { PlayerIndex } from '@common/types/player';

function generateRandomMap(
  size: Size2d,
  numPlayers: number,
): { grid: GameGrid; generals: PlayerSquare[] } {
  const grid = generateGridWithRandomMountains(size);
  const generals = addRandomGenerals(grid, numPlayers);
  return { grid, generals };
}

function generateRandomMapWithConstraints(
  size: Size2d,
  numPlayers: number,
  minGeneralDistance: number,
): { grid: GameGrid; generals: PlayerSquare[] } {
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const grid = generateGridWithRandomMountains(size);
    const generals = addGeneralsWithDistanceConstraint(
      grid,
      numPlayers,
      minGeneralDistance,
    );

    if (areAllGeneralsConnected(grid, generals)) {
      return { grid, generals };
    }

    if (repairConnectivity(grid, generals)) {
      return { grid, generals };
    }
  }

  throw new Error(
    `Failed to generate connected map after ${maxAttempts} attempts. ` +
      `Try reducing minGeneralDistance, increasing map size, or reducing mountain density.`,
  );
}

// ----------------------------------------------------------------------------

function generateBlankGrid(size: Size2d): GameGrid {
  const grid: any[][] = [];
  for (let y = 0; y < size.height; y++) {
    grid.push([]);
    for (let x = 0; x < size.width; x++) {
      grid[y].push(createBlankCell({ x, y }));
    }
  }
  return grid;
}

function generateGridWithRandomMountains(size: Size2d): GameGrid {
  const grid = generateBlankGrid(size);

  for (let y = 0; y < size.height; y++) {
    for (let x = 0; x < size.width; x++) {
      grid[y][x] = mountainOrBlank(grid, x, y);
    }
  }
  return grid;
}

// ----------------------------------------------------------------------------

function createBlankCell(coord: Coord): Square {
  return { coord, type: SquareType.BLANK };
}

function createArmyCell(
  coord: Coord,
  playerIndex: PlayerIndex,
  units: number,
): PlayerSquare {
  return {
    coord,
    type: SquareType.ARMY,
    playerIndex,
    units,
  };
}

// TODO: Think about how to make this more configurable
function mountainOrBlank(grid: GameGrid, x: number, y: number): Square {
  const nearbyMountains: number = getNeightbors(grid, x, y).filter(
    (cell) => cell && cell.type === SquareType.MOUNTAIN,
  ).length;

  const defaultProb = 0.1;
  const probMap = new Map<number, number>([
    [1, 0.35],
    [2, 0.35],
    [3, 0.05],
  ]);

  const mountainProb = probMap.get(nearbyMountains) || defaultProb;
  const isMountain = Math.random() < mountainProb;
  return {
    coord: { x, y },
    type: isMountain ? SquareType.MOUNTAIN : SquareType.BLANK,
  };
}

function getNeightbors(grid: GameGrid, x: number, y: number): Square[] {
  const neighbors = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const cell = grid[y + dy] && grid[y + dy][x + dx];
      if (cell) {
        neighbors.push(cell);
      }
    }
  }
  return neighbors;
}

// ----------------------------------------------------------------------------

function addGenerals(grid: GameGrid, coords: Coord[]): PlayerSquare[] {
  const playerSquares: PlayerSquare[] = [];
  coords.forEach((coord, index) => {
    const square = grid[coord.y][coord.x];
    const generalSquare = convertToGeneral(square, index);
    grid[coord.y][coord.x] = generalSquare;
    playerSquares.push(generalSquare);
  });
  return playerSquares;
}

function addRandomGenerals(grid: GameGrid, count: number): PlayerSquare[] {
  return addGeneralsWithDistanceConstraint(grid, count, 0);
}

function addGeneralsWithDistanceConstraint(
  grid: GameGrid,
  count: number,
  minDistance: number,
): PlayerSquare[] {
  const generals: PlayerSquare[] = [];
  const maxAttempts = 1000;

  const randCoord = (): Coord => ({
    x: Math.floor(Math.random() * grid[0].length),
    y: Math.floor(Math.random() * grid.length),
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

    const square = grid[coord.y][coord.x];
    const generalSquare = convertToGeneral(square, i);
    grid[coord.y][coord.x] = generalSquare;
    generals.push(generalSquare);
  }

  return generals;
}

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

function convertToGeneral(
  square: Square,
  playerIndex: PlayerIndex,
): PlayerSquare {
  if (!isNeutralSquare(square)) {
    throw new Error('Cannot convert non-neutral square to general');
  }
  return {
    ...square,
    type: SquareType.GENERAL,
    playerIndex,
    units: 1,
  };
}

// ----------------------------------------------------------------------------

function areAllGeneralsConnected(
  grid: GameGrid,
  generals: PlayerSquare[],
): boolean {
  if (generals.length <= 1) return true;

  const visited = new Set<string>();
  const queue: Coord[] = [generals[0].coord];
  visited.add(coordToString(generals[0].coord));
  let generalsFound = 1;

  while (queue.length > 0 && generalsFound < generals.length) {
    const current = queue.shift()!;
    const neighbors = getTraversableNeighbors(grid, current);

    for (const neighbor of neighbors) {
      const key = coordToString(neighbor);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(neighbor);

        if (isGeneralAtCoord(grid, neighbor)) {
          generalsFound++;
        }
      }
    }
  }

  return generalsFound === generals.length;
}

function getTraversableNeighbors(grid: GameGrid, coord: Coord): Coord[] {
  const neighbors: Coord[] = [];
  const directions = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];

  for (const dir of directions) {
    const newX = coord.x + dir.x;
    const newY = coord.y + dir.y;

    if (newX >= 0 && newX < grid[0].length && newY >= 0 && newY < grid.length) {
      const square = grid[newY][newX];
      if (square.type !== SquareType.MOUNTAIN) {
        neighbors.push({ x: newX, y: newY });
      }
    }
  }

  return neighbors;
}

function coordToString(coord: Coord): string {
  return `${coord.x},${coord.y}`;
}

function isGeneralAtCoord(grid: GameGrid, coord: Coord): boolean {
  return grid[coord.y][coord.x].type === SquareType.GENERAL;
}

function repairConnectivity(grid: GameGrid, generals: PlayerSquare[]): boolean {
  const maxRepairAttempts = 3;
  let attempts = 0;

  while (
    !areAllGeneralsConnected(grid, generals) &&
    attempts < maxRepairAttempts
  ) {
    const strategicMountains = findStrategicMountains(grid, generals);
    if (strategicMountains.length === 0) {
      return false;
    }

    const mountainToRemove = strategicMountains[0];
    grid[mountainToRemove.y][mountainToRemove.x] =
      createBlankCell(mountainToRemove);
    attempts++;
  }

  return areAllGeneralsConnected(grid, generals);
}

function findStrategicMountains(
  grid: GameGrid,
  generals: PlayerSquare[],
): Coord[] {
  const components = findConnectedComponents(grid, generals);
  const mountainScores = new Map<string, number>();

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      if (grid[y][x].type === SquareType.MOUNTAIN) {
        const mountainCoord = { x, y };
        const score = calculateMountainConnectivityScore(
          grid,
          mountainCoord,
          components,
          generals,
        );
        if (score > 0) {
          mountainScores.set(coordToString(mountainCoord), score);
        }
      }
    }
  }

  return Array.from(mountainScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([coordStr]) => stringToCoord(coordStr));
}

function findConnectedComponents(
  grid: GameGrid,
  generals: PlayerSquare[],
): Map<number, Set<number>> {
  const visited = new Set<number>();
  const components = new Map<number, Set<number>>();
  let componentId = 0;

  for (let i = 0; i < generals.length; i++) {
    if (!visited.has(i)) {
      const component = new Set<number>();
      const queue = [i];
      visited.add(i);
      component.add(i);

      while (queue.length > 0) {
        const currentGeneralIndex = queue.shift()!;
        const currentCoord = generals[currentGeneralIndex].coord;

        for (let j = 0; j < generals.length; j++) {
          if (
            !visited.has(j) &&
            canReachGeneral(grid, currentCoord, generals[j].coord)
          ) {
            visited.add(j);
            component.add(j);
            queue.push(j);
          }
        }
      }

      components.set(componentId++, component);
    }
  }

  return components;
}

function canReachGeneral(grid: GameGrid, start: Coord, target: Coord): boolean {
  const visited = new Set<string>();
  const queue = [start];
  visited.add(coordToString(start));

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.x === target.x && current.y === target.y) {
      return true;
    }

    const neighbors = getTraversableNeighbors(grid, current);
    for (const neighbor of neighbors) {
      const key = coordToString(neighbor);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(neighbor);
      }
    }
  }

  return false;
}

function calculateMountainConnectivityScore(
  grid: GameGrid,
  mountainCoord: Coord,
  components: Map<number, Set<number>>,
  generals: PlayerSquare[],
): number {
  const originalSquare = grid[mountainCoord.y][mountainCoord.x];

  grid[mountainCoord.y][mountainCoord.x] = createBlankCell(mountainCoord);

  const newComponents = findConnectedComponents(grid, generals);
  const connectivityImprovement = components.size - newComponents.size;

  grid[mountainCoord.y][mountainCoord.x] = originalSquare;

  return Math.max(0, connectivityImprovement);
}

function stringToCoord(coordStr: string): Coord {
  const [x, y] = coordStr.split(',').map(Number);
  return { x, y };
}

// ----------------------------------------------------------------------------

export {
  generateRandomMap,
  generateRandomMapWithConstraints,
  generateBlankGrid,
  generateGridWithRandomMountains,
  createBlankCell,
  createArmyCell,
  addGenerals,
  addRandomGenerals,
  addGeneralsWithDistanceConstraint,
  areAllGeneralsConnected,
  repairConnectivity,
  manhattanDistance,
};
