import type { GameState } from '@core/types';
import { Board } from '@core/board';
import { isPlayerSquare, isBlankSquare, isMountainSquare } from '@core/square';

import { ALL_DIRECTIONS } from './helpers';
import type { ScoringFn } from './types';

const landOnly: ScoringFn = (gameState: GameState): number => {
  return gameState.players[0].landCount;
};

// Multi-source BFS from all blank tiles. Returns distance-to-nearest-blank
// for every cell. Mountains get Infinity. Blank tiles get 0.
function buildDistanceToBlankMap(gameState: GameState): number[][] {
  const { board } = gameState;
  const { width, height } = board.size;
  const dist: number[][] = [];
  const queue: { x: number; y: number }[] = [];

  for (let y = 0; y < height; y++) {
    dist[y] = [];
    for (let x = 0; x < width; x++) {
      const square = Board.getSquare(board, { x, y });
      if (isBlankSquare(square)) {
        dist[y][x] = 0;
        queue.push({ x, y });
      } else {
        dist[y][x] = Infinity;
      }
    }
  }

  let head = 0;
  while (head < queue.length) {
    const coord = queue[head++];
    const d = dist[coord.y][coord.x];

    for (const dir of ALL_DIRECTIONS) {
      const neighbor = Board.applyDirection(coord, dir);
      if (!Board.isCoordValid(board, neighbor)) continue;
      if (dist[neighbor.y][neighbor.x] <= d + 1) continue;
      if (isMountainSquare(Board.getSquare(board, neighbor))) continue;

      dist[neighbor.y][neighbor.x] = d + 1;
      queue.push(neighbor);
    }
  }

  return dist;
}

// Score = currentLand + sum(max(0, excess - dist)) for each player tile
// Estimates how many tiles the current armies could capture via chain moves.
const capturableTiles: ScoringFn = (gameState: GameState): number => {
  const land = gameState.players[0].landCount;
  const distMap = buildDistanceToBlankMap(gameState);

  let capturable = 0;
  for (const coord of Board.iterCoords(gameState.board)) {
    const square = Board.getSquare(gameState.board, coord);
    if (!isPlayerSquare(square) || square.playerIndex !== 0) continue;
    const excess = square.units - 1;
    if (excess <= 0) continue;
    const dist = distMap[coord.y][coord.x];
    if (dist === Infinity) continue;
    capturable += Math.max(0, excess - dist);
  }

  return land + capturable;
};

// Same as capturableTiles but weights actual land 5x so capturing is
// always preferred over hoarding armies near blanks.
const landWeightedCapturable: ScoringFn = (gameState: GameState): number => {
  const land = gameState.players[0].landCount;
  const distMap = buildDistanceToBlankMap(gameState);

  let capturable = 0;
  for (const coord of Board.iterCoords(gameState.board)) {
    const square = Board.getSquare(gameState.board, coord);
    if (!isPlayerSquare(square) || square.playerIndex !== 0) continue;
    const excess = square.units - 1;
    if (excess <= 0) continue;
    const dist = distMap[coord.y][coord.x];
    if (dist === Infinity) continue;
    capturable += Math.max(0, excess - dist);
  }

  return land * 5 + capturable;
};

export { landOnly, capturableTiles, landWeightedCapturable };
