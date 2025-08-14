import type { BoardState, Coord } from '@core/types';
import { gameplayStore } from '@/pages/game/gameplay/gameplay-store';

interface GameplayState {
  boardState: BoardState | null;
  selectedTile: Coord | null;
  playerMapping: { playerId: string; playerIndex: number }[] | null;
  gameEnded: boolean;
  winner: number | null;
  endReason: 'general_captured' | 'timeout' | 'disconnect' | null;
  actions: {
    setBoardState: (boardState: BoardState) => void;
    setPlayerMapping: (mapping: { playerId: string; playerIndex: number }[]) => void;
    setSelectedTile: (coord: Coord | null) => void;
    setGameId: (gameId: number) => void;
    setTick: (tick: number) => void;
    setGameEnded: (winner: number, reason: 'general_captured' | 'timeout' | 'disconnect') => void;
    followArmyMovement: (sourceCoord: Coord, direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => void;
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
  const { actions } = gameplayStore.getState();

  return {
    boardState,
    selectedTile,
    playerMapping,
    gameEnded,
    winner,
    endReason,
    actions,
  };
}