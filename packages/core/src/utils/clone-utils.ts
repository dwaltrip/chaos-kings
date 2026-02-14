import type { GameState } from '@core/types';

function deepCloneBoard(board: GameState['board']): GameState['board'] {
  return {
    size: { ...board.size },
    grid: board.grid.map((row) =>
      row.map((square) => ({ ...square, coord: { ...square.coord } })),
    ),
  };
}

function deepCloneGameState(gameState: GameState): GameState {
  return {
    tick: gameState.tick,
    board: deepCloneBoard(gameState.board),
    players: gameState.players.map((p) => ({ ...p })),
  };
}

export { deepCloneBoard, deepCloneGameState };
