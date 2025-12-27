import { isEnded } from '@core/game';
import { PRE_GAME_COUNTDOWN_SECONDS } from '@core/ui-timing-config';
import type { GameWithPlayers } from '@platform/domains/games/types';

import { createAsyncStore } from '@/utils/create-async-store';

type GameplayPageExtensions = {
  countdownActive: boolean;
  countdownSeconds: number;
  // TODO: should derive `winner` from game object instead of separate state
  winner: number | null;
  isGameEnded: () => boolean;
  actions: {
    setGame: (game: GameWithPlayers) => void;
    updateGame: (updates: Partial<GameWithPlayers>) => void;
    setCountdownActive: (active: boolean) => void;
    setCountdownSeconds: (seconds: number) => void;
    setWinner: (winner: number) => void;
    resetAll: () => void;
  };
};

const extensionInitialState = {
  countdownActive: false,
  countdownSeconds: PRE_GAME_COUNTDOWN_SECONDS,
  winner: null as number | null,
};

const gameplayPageStore = createAsyncStore<GameWithPlayers, GameplayPageExtensions>(
  (set, get) => ({
    ...extensionInitialState,

    isGameEnded: () => {
      const game = get().data;
      return game ? isEnded(game) : false;
    },

    actions: {
      setGame: (game: GameWithPlayers) => {
        set({ data: game });
      },
      updateGame: (updates: Partial<GameWithPlayers>) => {
        const current = get().data;
        if (current) {
          set({ data: { ...current, ...updates } });
        }
      },
      setCountdownActive: (active: boolean) => {
        set({ countdownActive: active });
      },
      setCountdownSeconds: (seconds: number) => {
        set({ countdownSeconds: seconds });
      },
      setWinner: (winner: number) => {
        set({ winner });
      },
      resetAll: () => {
        get().reset(); // Reset base async store (data, loading, error)
        set({ ...extensionInitialState }); // Reset extension state
      },
    },
  }),
);

type GameplayPageState = ReturnType<typeof gameplayPageStore.getState>;

// Selectors
const selectGame = (state: GameplayPageState) => state.data;

function useIsGameEnded(state: GameplayPageState): boolean {
  return state.isGameEnded();
}

// TODO: resolve duplication of this in gameplay-store-v2
const useGameplayPageStore = gameplayPageStore;

export type { GameplayPageState };
export { gameplayPageStore, useGameplayPageStore, useIsGameEnded, selectGame };
