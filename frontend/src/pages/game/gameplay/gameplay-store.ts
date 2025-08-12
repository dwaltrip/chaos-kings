import { create } from 'zustand';
import type { BoardState, Coord } from '@core/types';

interface GameplayState {
  boardState: BoardState | null;
  playerMapping: { playerId: string; playerIndex: number }[] | null;
  selectedTile: Coord | null;
  gameId: number | null;
  tick: number;
  actions: {
    setBoardState: (boardState: BoardState) => void;
    setPlayerMapping: (mapping: { playerId: string; playerIndex: number }[]) => void;
    setSelectedTile: (coord: Coord | null) => void;
    setGameId: (gameId: number) => void;
    setTick: (tick: number) => void;
    reset: () => void;
  };
}

const gameplayStore = create<GameplayState>((set) => ({
  boardState: null,
  playerMapping: null,
  selectedTile: null,
  gameId: null,
  tick: 0,
  actions: {
    setBoardState: (boardState) => set({ boardState }),
    setPlayerMapping: (mapping) => set({ playerMapping: mapping }),
    setSelectedTile: (coord) => set({ selectedTile: coord }),
    setGameId: (gameId) => set({ gameId }),
    setTick: (tick) => set({ tick }),
    reset: () => set({
      boardState: null,
      playerMapping: null,
      selectedTile: null,
      gameId: null,
      tick: 0
    }),
  }
}));

export { gameplayStore };