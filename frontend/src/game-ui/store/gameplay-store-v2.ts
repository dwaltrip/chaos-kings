import { create } from 'zustand';

import type { BoardState, Coord } from '@core/types';
import { areCoordsEqual } from '@core/utils/coordinate-utils';
import { getCurrentPlayerIndex } from '@core/game/get-current-player-index';
import type { GameWithPlayers } from '@common/types/games';
import type { Movement } from '@common/types/gameplay';

import type { User } from '@/services/user-service';
import { isAdjacentTo } from '@/game-ui/utils/tile-utils';
import { gameMetadataStore } from '@/stores/game-metadata-store';
import { userStore } from '@/stores/user-store';
import { hasCompletedGameState, isEnded } from '@core/game';
import type { PlayerIndex } from '@common/types/player';
import { tileOrchestrator } from './tile-orchestrator';

interface GameplayStateV2 {
  user: User | null;
  game: GameWithPlayers | null;
  tick: number;
  winner: PlayerIndex | null;

  boardState: BoardState | null;
  selectedTile: Coord | null;
  visibleSquares: Set<string>;
  queuedMoves: Movement[];

  // derived state
  currentPlayerIndex: () => number | null;
  isGameEnded: () => boolean;

  // TODO / QUESTION: TS doesn't seem to complain if I don't define these here?
  actions: {
    setTick: (tick: number) => void;
    setSelectedTileV2: (coord: Coord) => void;
    clearSelectedTile: () => void;
    updateBoard: (boardState: BoardState) => void;
    setVisibleSquares: (visibleSquares: Set<string>) => void;
    setQueuedMoves: (moves: Movement[]) => void;
    addQueuedMove: (move: Movement) => void;
    setWinner: (winner: PlayerIndex) => void;
  };
}

// TODO: make this the source of truth and only place that "stores" currentPlayerIndex
const useGameplayStoreV2 = create<GameplayStateV2>((set, get) => {
  const syncUser = () => {
    const newUser = userStore.getState().user;
    if (newUser?.id !== get().user?.id) {
      set({ user: newUser || null });
    }
  };
  const syncGame = () => {
    const newGame = gameMetadataStore.getState().game;
    if (newGame !== get().game) {
      set({ game: newGame || null });
      console.log('[gameplay-store-v2] Updated game object:', get().game);
    }
  };

  gameMetadataStore.subscribe(syncGame);
  userStore.subscribe(syncUser);

  const user = userStore.getState().user || null;
  const game = gameMetadataStore.getState().game || null;
  return {
    user,
    game,
    tick: 0,
    winner: null,

    boardState: null,
    selectedTile: null,
    visibleSquares: new Set<string>(),
    queuedMoves: [],

    isGameEnded() {
      const { game } = get();
      return game ? isEnded(game) : false;
    },

    currentPlayerIndex() {
      const { game, user } = get();
      return game && user
        ? getCurrentPlayerIndex(game, user?.id ?? null)
        : null;
    },

    actions: {
      setTick: (tick) => set({ tick }),

      setSelectedTileV2: (coord: Coord) => set({ selectedTile: coord }),
      clearSelectedTile: () => set({ selectedTile: null }),

      updateBoard: (boardState: BoardState) => {
        set({ boardState });
        tileOrchestrator.updateTileSquares(boardState);
      },
      setVisibleSquares: (visibleSquares) => set({ visibleSquares }),
      setQueuedMoves: (moves) => set({ queuedMoves: moves }),
      addQueuedMove: (move) => {
        const { queuedMoves } = get();
        set({ queuedMoves: [...queuedMoves, move] });
      },
      setWinner: (winner) => set({ winner }),
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

function useGameplayGame(state: GameplayStateV2) {
  return state.game;
}

function useIsGameEnded(state: GameplayStateV2) {
  return state.isGameEnded();
}

function useBoardState(state: GameplayStateV2) {
  return getBoardState(state.game, state.boardState);
}

// ---------------------------------

// TODO: This is a temp hack while we aren't consistently storing board state in game
// on the backend.
function getBoardState(
  game: GameWithPlayers | null,
  boardState: BoardState | null,
): BoardState | null {
  if (game && hasCompletedGameState(game)) {
    return game.game_state.board;
  }
  // When users are still on the game page, they haven't loaded the updated game,
  // so we need to use boardState instead of game_state.board
  if (boardState && !(game?.game_state as any)?.board) {
    return boardState;
  }

  if (game && isEnded(game)) {
    throw new Error(
      'Game is completed but board state is not available or malformed',
    );
  }

  return boardState;
}

function useCurrentPlayerIndex(state: GameplayStateV2) {
  return state.currentPlayerIndex();
}

// ---------------------------------

// Trying out a new pattern for accessing zustand actions
// We were extracting actions at the module level before,
// which would usually work in most situations but is not 100% safe.
// This helper makes it more ergonomic to access actions locally in functions.
const gameplayActions = () => useGameplayStoreV2.getState().actions;

// ---------------------------------

export {
  type GameplayStateV2,
  useGameplayStoreV2,
  gameplayActions,
  useGameplayGame,
  useIsGameEnded,
  useBoardState,
  useSelectedTile,
  useCurrentPlayerIndex,
  useIsTileSelected,
  useIsAdjacentToSelected,
};
