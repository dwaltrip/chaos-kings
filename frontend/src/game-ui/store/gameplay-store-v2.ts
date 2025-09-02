import { create } from 'zustand';

import type { BoardState, Coord } from '@core/types';
import { areCoordsEqual } from '@core/utils/coordinate-utils';

import { isAdjacentTo } from '@/game-ui/utils/tile-utils';
import {
  gameMetadataStore,
  getCurrentPlayerIndex,
} from '@/stores/game-metadata-store';
import { userStore } from '@/stores/user-store';
import { Board } from '@core/board';

interface GameplayStateV2 {
  selectedTile: Coord | null;
  boardState: BoardState | null;
  visibleSquares: Set<string>;
  isGameEnded: boolean;
  currentPlayerIndex: number | null;

  // QUESTION: TS doesn't seem to complain if I don't define these here?
  actions: {
    setSelectedTileV2: (coord: Coord) => void;
    clearSelectedTile: () => void;
    setBoardState: (
      boardState: BoardState | null,
      currentPlayerIndex?: number | null,
    ) => void;
  };
}

const useGameplayStoreV2 = create<GameplayStateV2>((set, get) => {
  // Subscribe to gameMetadataStore for isGameEnded
  gameMetadataStore.subscribe((state) => {
    const currentState = get();
    if (currentState.isGameEnded !== state.isGameEnded) {
      set({ isGameEnded: state.isGameEnded });
    }
  });

  // Subscribe to both stores for currentPlayerIndex computation
  const syncPlayerIndex = () => {
    const game = gameMetadataStore.getState().game;
    const user = userStore.getState().user;
    const newPlayerIndex = getCurrentPlayerIndex(game, user?.id ?? null);

    const currentState = get();
    if (currentState.currentPlayerIndex !== newPlayerIndex) {
      set({ currentPlayerIndex: newPlayerIndex });
    }
  };

  gameMetadataStore.subscribe(syncPlayerIndex);
  userStore.subscribe(syncPlayerIndex);

  return {
    selectedTile: null,
    boardState: null,
    visibleSquares: new Set<string>(),
    isGameEnded: gameMetadataStore.getState().isGameEnded,
    currentPlayerIndex: (() => {
      const game = gameMetadataStore.getState().game;
      const user = userStore.getState().user;
      return getCurrentPlayerIndex(game, user?.id ?? null);
    })(),

    actions: {
      setSelectedTileV2: (coord: Coord) => set({ selectedTile: coord }),
      clearSelectedTile: () => set({ selectedTile: null }),

      setBoardState: (
        boardState: BoardState | null,
        currentPlayerIndex?: number | null,
      ) => {
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
      },
    },
  };
});

// ----------- Selectors -----------

const useSelectedTile = (state: GameplayStateV2) => state.selectedTile;

const useIsTileSelected =
  (coord: Coord) =>
  ({ selectedTile }: GameplayStateV2): boolean =>
    areCoordsEqual(selectedTile, coord);

const useIsAdjacentToSelected =
  (coord: Coord) =>
  ({ selectedTile }: GameplayStateV2): boolean =>
    selectedTile ? isAdjacentTo(selectedTile, coord) : false;

export {
  type GameplayStateV2,
  useGameplayStoreV2,
  useSelectedTile,
  useIsTileSelected,
  useIsAdjacentToSelected,
};
