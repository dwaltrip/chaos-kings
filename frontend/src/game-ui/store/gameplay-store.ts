import { create } from 'zustand';
import type { BoardState, Coord, Movement } from '@core/types';
import { Board } from '@core/board';
import { gameMetadataStore } from '@/stores/game-metadata-store';

interface GameplayState {
  boardState: BoardState | null;
  playerMapping: { playerId: string; playerIndex: number }[] | null;
  selectedTile: Coord | null;
  gameId: number | null;
  tick: number;
  gameEnded: boolean;
  winner: number | null;
  endReason: 'general_captured' | 'timeout' | 'disconnect' | null;
  queuedMoves: Array<{ sourceCoord: Coord; direction: Movement }>;
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
    followArmyMovement: (sourceCoord: Coord, direction: Movement) => void;
    setQueuedMoves: (
      moves: Array<{ sourceCoord: Coord; direction: Movement }>,
    ) => void;
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
  queuedMoves: [],
  actions: {
    setBoardState: (boardState) => set({ boardState }),
    setPlayerMapping: (mapping) => {
      set({ playerMapping: mapping });
      // Bridge to metadata store for GamePage header display
      gameMetadataStore.getState().actions.setPlayerMapping(mapping);
    },
    setSelectedTile: (coord) => set({ selectedTile: coord }),
    setGameId: (gameId) => set({ gameId }),
    setTick: (tick) => set({ tick }),
    setGameEnded: (winner, reason) => {
      set({ gameEnded: true, winner, endReason: reason });
      // Bridge to metadata store for GamePage header display
      gameMetadataStore.getState().actions.setGameEnded(winner, reason);
    },
    followArmyMovement: (sourceCoord, direction) =>
      set((state) => {
        if (!state.boardState) return state;

        const destinationCoord = Board.applyDirection(sourceCoord, direction);

        // Only update selection if the destination is valid and the source matches current selection
        if (
          Board.isCoordValid(state.boardState, destinationCoord) &&
          state.selectedTile &&
          state.selectedTile.x === sourceCoord.x &&
          state.selectedTile.y === sourceCoord.y
        ) {
          return { selectedTile: destinationCoord };
        }

        return state;
      }),
    setQueuedMoves: (moves) =>
      set((state) => {
        const moveToKey = (move: { sourceCoord: Coord; direction: Movement }) =>
          `${move.sourceCoord.x},${move.sourceCoord.y},${move.direction}`;

        const currentKeys = new Set(state.queuedMoves.map(moveToKey));
        const newKeys = new Set(moves.map(moveToKey));

        // Find removed arrows and delay their removal
        const removedArrows = state.queuedMoves.filter(
          (move) => !newKeys.has(moveToKey(move)),
        );
        removedArrows.forEach((arrow) => {
          setTimeout(() => {
            set((currentState) => ({
              queuedMoves: currentState.queuedMoves.filter(
                (move) => moveToKey(move) !== moveToKey(arrow),
              ),
            }));
          }, 500);
        });

        return { queuedMoves: [...moves, ...removedArrows] };
      }),
    reset: () =>
      set({
        boardState: null,
        playerMapping: null,
        selectedTile: null,
        gameId: null,
        tick: 0,
        gameEnded: false,
        winner: null,
        endReason: null,
        queuedMoves: [],
      }),
  },
}));

export { gameplayStore };
