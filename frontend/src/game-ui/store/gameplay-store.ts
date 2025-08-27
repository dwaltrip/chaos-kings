import { create } from 'zustand';
import type { BoardState, Coord, Movement } from '@core/types';
import { Board } from '@core/board';
import { gameMetadataStore } from '@/stores/game-metadata-store';
import { tileOrchestrator } from './tile-orchestrator';
import { getTileStore } from './tile-store-registry';

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
  queuedMovesByCoord: Map<string, Set<Movement>>;
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
    setQueuedMovesFromArray: (
      moves: Array<{ sourceCoord: Coord; direction: Movement }>,
    ) => void;
    addQueuedMove: (sourceCoord: Coord, direction: Movement) => void;
    clearAllQueuedMoves: () => void;
    reset: () => void;
  };
}

const gameplayStore = create<GameplayState>((set, get) => ({
  boardState: null,
  playerMapping: null,
  selectedTile: null,
  gameId: null,
  tick: 0,
  gameEnded: false,
  winner: null,
  endReason: null,
  queuedMoves: [],
  queuedMovesByCoord: new Map(),
  actions: {
    setBoardState: (boardState) => {
      set({ boardState });
      // Phase 1b: Update tile stores w/ square info
      if (boardState) {
        tileOrchestrator.updateTileSquares(boardState);
      }
    },
    setPlayerMapping: (mapping) => {
      set({ playerMapping: mapping });
      // Bridge to metadata store for GamePage header display
      gameMetadataStore.getState().actions.setPlayerMapping(mapping);
    },
    setSelectedTile: (coord) =>
      set((state) => {
        const newState = { selectedTile: coord };
        // Phase 1: Update tile stores with selection state
        if (state.boardState) {
          tileOrchestrator.updateSelectedTileFromBoard(coord, state.boardState);
        }
        return newState;
      }),
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
      set(() => {
        return { queuedMoves: moves };
      }),
    setQueuedMovesFromArray: (moves) =>
      set(() => {
        const grid = get().boardState?.grid;
        if (!grid) {
          return { queuedMoves: [], queuedMovesByCoord: new Map() };
        }

        // TODO: resetting the state should happen all in one place
        // Clear all existing moves in tile store
        for (let y = 0; y < grid.length; y++) {
          for (let x = 0; x < grid[y].length; x++) {
            getTileStore({ x, y }).getState().updateQueuedMoves(new Set());
          }
        }

        // Convert array to coordinate-keyed Record
        const queuedMovesByCoord: Map<string, Set<Movement>> = new Map();
        for (const move of moves) {
          const key = `${move.sourceCoord.x},${move.sourceCoord.y}`;
          if (!queuedMovesByCoord.has(key)) {
            queuedMovesByCoord.set(key, new Set());
          }
          queuedMovesByCoord.get(key)?.add(move.direction);
        }

        // Phase 1: Update tile stores with queued moves
        tileOrchestrator.updateQueuedMoves(queuedMovesByCoord);

        return { queuedMoves: moves, queuedMovesByCoord };
      }),
    addQueuedMove: (sourceCoord, direction) =>
      set((state) => {
        const key = `${sourceCoord.x},${sourceCoord.y}`;
        const directionForTile = state.queuedMovesByCoord.get(key) || new Set();
        directionForTile.add(direction);
        state.queuedMovesByCoord.set(key, directionForTile);

        // Phase 1: Update tile stores with new queued moves
        tileOrchestrator.updateQueuedMoves(state.queuedMovesByCoord);

        return {
          queuedMoves: [...state.queuedMoves, { sourceCoord, direction }],
          // TODO: is this idiomatic?
          // Seems dumb to create a new Map each time.
          queuedMovesByCoord: state.queuedMovesByCoord,
        };
      }),
    clearAllQueuedMoves: () =>
      set(() => {
        console.log(`[GameplayStore] clearAllQueuedMoves: clearing all moves`);
        const emptyMoves = new Map();

        // Phase 1: Update tile stores to clear all moves
        tileOrchestrator.updateQueuedMoves(emptyMoves);

        return {
          queuedMoves: [],
          queuedMovesByCoord: emptyMoves,
        };
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
        queuedMovesByCoord: new Map(),
      }),
  },
}));

export function useSetSelectedTile() {
  return gameplayStore((state) => state.actions.setSelectedTile);
}

export { gameplayStore };
