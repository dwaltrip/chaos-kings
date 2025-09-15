import { create } from 'zustand';

import type { BoardState, Coord, Direction } from '@core/types';
import { Board } from '@core/board';
import { areCoordsEqual } from '@core/utils/coordinate-utils';

import { gameMetadataStore } from '@/stores/game-metadata-store';
import { tileOrchestrator } from './tile-orchestrator';
import { getTileStore } from './tile-store-registry';
import { useGameplayStoreV2 } from '@/game-ui/store/gameplay-store-v2';

interface GameplayState {
  boardState: BoardState | null;
  visibleSquares: Set<string>;
  playerMapping: { playerId: string; playerIndex: number }[] | null;
  gameId: number | null;
  tick: number;
  gameEnded: boolean;
  winner: number | null;
  endReason: 'general_captured' | 'timeout' | 'disconnect' | null;
  queuedMoves: Array<{ sourceCoord: Coord; direction: Direction }>;
  actions: {
    setBoardState: (
      boardState: BoardState,
      currentPlayerIndex?: number | null,
    ) => void;
    setPlayerMapping: (
      mapping: { playerId: string; playerIndex: number }[],
    ) => void;
    setGameId: (gameId: number) => void;
    setTick: (tick: number) => void;
    setGameEnded: (
      winner: number,
      reason: 'general_captured' | 'timeout' | 'disconnect',
    ) => void;
    setQueuedMoves: (
      moves: Array<{ sourceCoord: Coord; direction: Direction }>,
    ) => void;
    setQueuedMovesFromArray: (
      moves: Array<{ sourceCoord: Coord; direction: Direction }>,
    ) => void;
    addQueuedMove: (sourceCoord: Coord, direction: Direction) => void;
    undoQueuedMove: () => void;
    clearAllQueuedMoves: () => void;
    reset: () => void;
  };
}

const gameplayStore = create<GameplayState>((set, get) => ({
  boardState: null,
  visibleSquares: new Set<string>(),
  playerMapping: null,
  gameId: null,
  tick: 0,
  gameEnded: false,
  winner: null,
  endReason: null,
  queuedMoves: [],
  actions: {
    setBoardState: (boardState, currentPlayerIndex) => {
      // Compute visible squares if we have the required data
      let visibleSquares = new Set<string>();
      if (
        boardState &&
        currentPlayerIndex !== null &&
        currentPlayerIndex !== undefined
      ) {
        visibleSquares = Board.getVisibleSquares(
          boardState,
          currentPlayerIndex,
        );
      }

      set({ boardState, visibleSquares });
      if (boardState) {
        tileOrchestrator.updateTileSquares(boardState);
      }
    },
    setPlayerMapping: (mapping) => {
      set({ playerMapping: mapping });
      // Bridge to metadata store for GamePage header display
      gameMetadataStore.getState().actions.setPlayerMapping(mapping);
    },
    setGameId: (gameId) => set({ gameId }),
    setTick: (tick) => set({ tick }),
    setGameEnded: (winner, reason) => {
      set({ gameEnded: true, winner, endReason: reason });
      // Bridge to metadata store for GamePage header display
      gameMetadataStore.getState().actions.setGameEnded(winner, reason);
    },
    setQueuedMoves: (moves) =>
      set(() => {
        return { queuedMoves: moves };
      }),
    setQueuedMovesFromArray: (moves) =>
      set(() => {
        const grid = get().boardState?.grid;
        // TODO: there should always be a grid.. fix this, shoulnd not need this check
        if (!grid) {
          return { queuedMoves: [] };
        }

        // TODO: resetting the state should happen all in one place
        // Clear all existing moves in tile store
        // TODO: use helper for iterating over all coords
        for (let y = 0; y < grid.length; y++) {
          for (let x = 0; x < grid[y].length; x++) {
            getTileStore({ x, y }).getState().updateQueuedMoves(new Set());
          }
        }

        for (const move of moves) {
          const store = getTileStore(move.sourceCoord);
          store.getState().addQueuedMove(move.direction);
        }
        return { queuedMoves: moves };
      }),
    addQueuedMove: (sourceCoord, direction) =>
      set((state) => {
        const newMove = { sourceCoord, direction };
        return { queuedMoves: [...state.queuedMoves, newMove] };
      }),
    // TODO: I'd like move logic like this into dedicated "action" files,
    // with 1 action per file, mostly decoupled from the store / zustand
    // Similar to how the backend actions are structured.
    // Need to look into this more.
    undoQueuedMove: () =>
      set((state) => {
        const { queuedMoves } = state;
        if (queuedMoves.length === 0) {
          return state;
        }
        const lastMove = queuedMoves[queuedMoves.length - 1];

        const tileStore = getTileStore(lastMove.sourceCoord);
        const newMoves = new Set(tileStore.getState().queuedMoves);
        newMoves.delete(lastMove.direction);
        tileStore.getState().updateQueuedMoves(newMoves);

        const selectedTile = useGameplayStoreV2.getState().selectedTile;
        const destCoord = Board.applyDirection(
          lastMove.sourceCoord,
          lastMove.direction,
        );
        if (selectedTile && areCoordsEqual(selectedTile, destCoord)) {
          useGameplayStoreV2
            .getState()
            .actions.setSelectedTileV2(lastMove.sourceCoord);
        }

        return {
          queuedMoves: state.queuedMoves.slice(0, -1),
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
        visibleSquares: new Set<string>(),
        playerMapping: null,
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
