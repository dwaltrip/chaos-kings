import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';

import { isEnded } from '@core/game';
import { PRE_GAME_COUNTDOWN_SECONDS } from '@core/ui-timing-config';
import type { GameWithPlayers } from '@platform/domains/games/types';

interface GameMetadataState {
  // Static metadata from API
  game: GameWithPlayers | null;
  loading: boolean;
  error: string | null;

  // Game start countdown
  countdownActive: boolean;
  countdownSeconds: number;

  // TODO: should derive `winner` from game object instead of separate state
  winner: number | null;

  // helpers
  isGameEnded: () => boolean;

  // Actions
  actions: {
    setGame: (game: GameWithPlayers) => void;
    updateGame: (updates: Partial<GameWithPlayers>) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setCountdownActive: (active: boolean) => void;
    setCountdownSeconds: (seconds: number) => void;
    setWinner: (winner: number) => void;
  };
}

const gameMetadataStore = create<GameMetadataState>((set, get) => ({
  // Static metadata
  game: null,
  loading: false,
  error: null,

  // Game start countdown
  countdownActive: false,
  countdownSeconds: PRE_GAME_COUNTDOWN_SECONDS,

  // Dynamic gameplay metadata
  winner: null,

  // helpers
  isGameEnded: () => {
    const game = get().game;
    return game ? isEnded(game) : false;
  },

  actions: {
    setGame: (game: GameWithPlayers) => {
      set({ game });
    },

    updateGame: (updates: Partial<GameWithPlayers>) => {
      set((state) => ({
        game: state.game ? { ...state.game, ...updates } : null,
      }));
      console.log('[game-metadata-store] Updated game object:', get().game);
    },

    setLoading: (loading: boolean) => {
      set({ loading });
    },

    setError: (error: string | null) => {
      set({ error });
    },

    setCountdownActive: (active: boolean) => {
      set({ countdownActive: active });
    },

    setCountdownSeconds: (seconds: number) => {
      set({ countdownSeconds: seconds });
    },

    setWinner: (winner: number) => set({ winner }),
  },
}));

// TODO: REFACTOR
const useGameLoadingState = () => {
  return gameMetadataStore(
    useShallow((state) => ({
      game: state.game,
      loading: state.loading,
      error: state.error,
    })),
  );
};

// TODO: resolve duplication of this in gameplay-store-v2
function useIsGameEnded(state: GameMetadataState): boolean {
  return state.isGameEnded();
}

const useGameMetadataStore = gameMetadataStore;

export { gameMetadataStore, useGameMetadataStore, useGameLoadingState, useIsGameEnded };
