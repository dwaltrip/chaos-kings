import type { BoardState, Coord } from '@core/types';
import { GameStatus, type GameWithPlayers } from '@common/types/games';
import { gameplayStore } from '@/game-ui/store/gameplay-store';
import { gameMetadataStore } from '@/stores/game-metadata-store';
import { hasCompletedGameState } from '@core/game';

interface GameplayState {
  boardState: BoardState | null;
  selectedTile: Coord | null;
  playerMapping: { playerId: string; playerIndex: number }[] | null;
  gameEnded: boolean;
  winner: number | null;
  endReason: 'general_captured' | 'timeout' | 'disconnect' | null;
  game: GameWithPlayers | null;
  actions: {
    setBoardState: (boardState: BoardState) => void;
    setPlayerMapping: (
      mapping: { playerId: string; playerIndex: number }[],
    ) => void;
    setSelectedTile: (coord: Coord | null) => void;
    setGameId: (gameId: number) => void;
    setTick: (tick: number) => void;
    setGameEnded: (
      winner: number,
      reason: 'general_captured' | 'timeout' | 'disconnect',
    ) => void;
    followArmyMovement: (
      sourceCoord: Coord,
      direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT',
    ) => void;
    reset: () => void;
  };
}

function useGameplayState(_gameId: number | null): GameplayState {
  const boardState = gameplayStore((state) => state.boardState);
  const selectedTile = gameplayStore((state) => state.selectedTile);
  const playerMapping = gameplayStore((state) => state.playerMapping);
  const gameEnded = gameplayStore((state) => state.gameEnded);
  const winner = gameplayStore((state) => state.winner);
  const endReason = gameplayStore((state) => state.endReason);
  // -------------------------------------------------------------------------
  // TODO: This is the only useage of `gameMetadataStore`
  // it's not a problem per se, but wanna be intentional about the structure
  // of all these stores I'm using for game, game play, etc.
  // -------------------------------------------------------------------------
  // TODO: Also I want it to be obvious what's coming from where.
  // I missed the the fact that it was a different store when glancing over.
  // -------------------------------------------------------------------------
  const game = gameMetadataStore((state) => state.game);
  const { actions } = gameplayStore.getState();

  return {
    boardState,
    selectedTile,
    playerMapping,
    gameEnded,
    winner,
    endReason,
    game,
    actions,
  };
}

// TODO: Clean this up
// There should be just one way to get the current board state
function useBoardState(): BoardState | null {
  const game = gameMetadataStore((state) => state.game);
  const boardState = gameplayStore((state) => state.boardState);

  if (game && hasCompletedGameState(game)) {
    return game.game_state.board;
  }
  // When users are still on the game page, they haven't loaded the updated game,
  // so we need to use boardState instead of game_state.board
  if (boardState && !(game?.game_state as any)?.board) {
    return boardState;
  }

  if (game && game.status === GameStatus.COMPLETE) {
    throw new Error(
      'Game is completed but board state is not available or malformed',
    );
  }

  return boardState;
}

export { useGameplayState, useBoardState };
