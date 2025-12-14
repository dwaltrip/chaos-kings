import { create } from 'zustand';

import { isEnded } from '@core/game';
import { PRE_GAME_COUNTDOWN_SECONDS } from '@core/ui-timing-config';
import type { GameWithPlayers } from '@platform/domains/games/types';

interface GameMetadataState {
  // Static metadata from API
  game: GameWithPlayers | null;

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
    setCountdownActive: (active: boolean) => void;
    setCountdownSeconds: (seconds: number) => void;
    setWinner: (winner: number) => void;
  };
}

const gameMetadataStore = create<GameMetadataState>((set, get) => ({
  // Static metadata
  game: null,

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

    setCountdownActive: (active: boolean) => {
      set({ countdownActive: active });
    },

    setCountdownSeconds: (seconds: number) => {
      set({ countdownSeconds: seconds });
    },

    setWinner: (winner: number) => set({ winner }),
  },
}));

// TODO: resolve duplication of this in gameplay-store-v2
function useIsGameEnded(state: GameMetadataState): boolean {
  return state.isGameEnded();
}

const useGameMetadataStore = gameMetadataStore;

export { gameMetadataStore, useGameMetadataStore, useIsGameEnded };
