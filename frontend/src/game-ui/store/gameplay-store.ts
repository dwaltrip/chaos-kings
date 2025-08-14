import { create } from 'zustand';
import type { BoardState, Coord, Movement } from '@core/types';
import { Board } from '@core/board';

interface GameplayState {
  boardState: BoardState | null;
  playerMapping: { playerId: string; playerIndex: number }[] | null;
  selectedTile: Coord | null;
  gameId: number | null;
  tick: number;
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
    followArmyMovement: (sourceCoord: Coord, direction: Movement) => void;
    reset: () => void;
  };
}

const gameplayStore = create<GameplayState>((set) => ({
  boardState: null,
  playerMapping: null,
  selectedTile: null,
  gameId: null,
  tick: 0,
  gameEnded: false,
  winner: null,
  endReason: null,
  actions: {
    setBoardState: (boardState) => set({ boardState }),
    setPlayerMapping: (mapping) => set({ playerMapping: mapping }),
    setSelectedTile: (coord) => set({ selectedTile: coord }),
    setGameId: (gameId) => set({ gameId }),
    setTick: (tick) => set({ tick }),
    setGameEnded: (winner, reason) => set({ gameEnded: true, winner, endReason: reason }),
    followArmyMovement: (sourceCoord, direction) => set((state) => {
      if (!state.boardState) return state;
      
      const destinationCoord = Board.applyDirection(sourceCoord, direction);
      
      // Only update selection if the destination is valid and the source matches current selection
      if (Board.isCoordValid(state.boardState, destinationCoord) && 
          state.selectedTile && 
          state.selectedTile.x === sourceCoord.x && 
          state.selectedTile.y === sourceCoord.y) {
        return { selectedTile: destinationCoord };
      }
      
      return state;
    }),
    reset: () => set({
      boardState: null,
      playerMapping: null,
      selectedTile: null,
      gameId: null,
      tick: 0,
      gameEnded: false,
      winner: null,
      endReason: null
    }),
  }
}));

export { gameplayStore };