import type { BoardState, Coord } from '@core/types';
import type { GameWithPlayers } from '@common/types/games';
import { gameplayStore } from '@/game-ui/store/gameplay-store';
import { gameMetadataStore } from '@/stores/game-metadata-store';

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

export function useGameplayState(_gameId: number | null): GameplayState {
  const boardState = gameplayStore((state) => state.boardState);
  const selectedTile = gameplayStore((state) => state.selectedTile);
  const playerMapping = gameplayStore((state) => state.playerMapping);
  const gameEnded = gameplayStore((state) => state.gameEnded);
  const winner = gameplayStore((state) => state.winner);
  const endReason = gameplayStore((state) => state.endReason);
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
