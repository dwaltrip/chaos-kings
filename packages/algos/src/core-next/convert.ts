import type { GameState, BoardState, Square } from '@core/types';
import { PlayerSquareType, NeutralSquareType, CorePlayerStatus } from '@core/types';
import { isPlayerSquare } from '@core/square';

import { TileType, NO_OWNER, Board } from './flat-board';
import type { FlatBoard } from './flat-board';

// --- Map between type systems ---

const squareTypeToTileType: Record<string, TileType> = {
  [NeutralSquareType.BLANK]: TileType.BLANK,
  [NeutralSquareType.MOUNTAIN]: TileType.MOUNTAIN,
  // NEUTRAL_CITY not supported yet
  [PlayerSquareType.ARMY]: TileType.ARMY,
  [PlayerSquareType.GENERAL]: TileType.GENERAL,
  [PlayerSquareType.PLAYER_CITY]: TileType.PLAYER_CITY,
};

const tileTypeToSquareType: Record<number, string> = {
  [TileType.BLANK]: NeutralSquareType.BLANK,
  [TileType.MOUNTAIN]: NeutralSquareType.MOUNTAIN,
  [TileType.ARMY]: PlayerSquareType.ARMY,
  [TileType.GENERAL]: PlayerSquareType.GENERAL,
  [TileType.PLAYER_CITY]: PlayerSquareType.PLAYER_CITY,
};

// --- GameState → FlatBoard ---

function fromBoardState(boardState: BoardState, playerCount: number): FlatBoard {
  const { width, height } = boardState.size;
  const board = Board.create(width, height, playerCount);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const square: Square = boardState.grid[y][x];
      const idx = y * width + x;

      const tileType = squareTypeToTileType[square.type];
      if (tileType === undefined) {
        throw new Error(`Unknown square type: ${square.type}`);
      }

      board.types[idx] = tileType;

      if (isPlayerSquare(square)) {
        board.owners[idx] = square.playerIndex;
        board.units[idx] = square.units;
      }
    }
  }

  Board.recomputeStats(board);
  return board;
}

function fromGameState(gameState: GameState): FlatBoard {
  return fromBoardState(gameState.board, gameState.players.length);
}

// --- FlatBoard → GameState ---

function toBoardState(board: FlatBoard): BoardState {
  const { width, height } = board;
  const grid: Square[][] = [];

  for (let y = 0; y < height; y++) {
    const row: Square[] = [];
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const tileType = board.types[idx];
      const owner = board.owners[idx];
      const units = board.units[idx];
      const coord = { x, y };

      const squareType = tileTypeToSquareType[tileType];
      if (squareType === undefined) {
        throw new Error(`Unknown tile type: ${tileType}`);
      }

      if (owner === NO_OWNER) {
        row.push({ type: squareType as any, coord });
      } else {
        row.push({ type: squareType as any, coord, playerIndex: owner, units });
      }
    }
    grid.push(row);
  }

  return { grid, size: { width, height } };
}

function toGameState(board: FlatBoard, tick: number): GameState {
  const boardState = toBoardState(board);

  const playerCount = board.stats.landCounts.length;
  const players = Array.from({ length: playerCount }, (_, i) => ({
    status: CorePlayerStatus.ACTIVE,
    armyCount: board.stats.armyCounts[i],
    landCount: board.stats.landCounts[i],
  }));

  return { board: boardState, tick, players };
}

export { fromGameState, fromBoardState, toGameState, toBoardState };
