import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';

import { isEnded } from '@core/game';
import type { GameWithPlayers } from '@common/types/games';
import type { PlayerIndex } from '@common/types/player';
import { PRE_GAME_COUNTDOWN_SECONDS } from '@core/ui-timing-config';

import { loadGame as apiLoadGame, GameNotFoundError } from '@/pages/game/games-api';

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
  playerMapping: { playerId: string; playerIndex: PlayerIndex }[] | null;

  // helpers
  isGameEnded: () => boolean;

  // Actions
  actions: {
    loadGame: (gameId: string) => Promise<void>;
    setGame: (game: GameWithPlayers) => void;
    updateGame: (updates: Partial<GameWithPlayers>) => void;
    setError: (error: string | null) => void;
    setCountdownActive: (active: boolean) => void;
    setCountdownSeconds: (seconds: number) => void;
    setWinner: (winner: number) => void;
    setPlayerMapping: (mapping: { playerId: string; playerIndex: PlayerIndex }[]) => void;
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
  playerMapping: null,

  // helpers
  isGameEnded: () => {
    const game = get().game;
    return game ? isEnded(game) : false;
  },

  actions: {
    loadGame: async (gameId: string) => {
      const state = get();
      // Prevent duplicate loads
      if (
        state.loading ||
        (state.game && state.game.id.toString() === gameId) ||
        // Don't try to load a game if there's an error
        state.error
      ) {
        return;
      }

      try {
        set({ loading: true, error: null });
        const game = await apiLoadGame(gameId);

        // -------------------------------------------------------------
        // TODO: This isn't how the countdown should be setup
        // Should happen somewhere more obvious and a distinct action
        // -------------------------------------------------------------
        // Initialize countdown if game hasn't started yet
        const shouldStartCountdown = game.status === 'not_started';
        set({
          game,
          loading: false,
          countdownActive: shouldStartCountdown,
        });
      } catch (err) {
        let errorMessage = 'Failed to load game';
        if (err instanceof GameNotFoundError) {
          errorMessage = 'Game not found';
        }
        console.error(`Error loading game (id=${gameId}):`, err);
        set({ error: errorMessage, loading: false });
      }
    },

    setGame: (game: GameWithPlayers) => {
      set({ game });
    },

    updateGame: (updates: Partial<GameWithPlayers>) => {
      set((state) => ({
        game: state.game ? { ...state.game, ...updates } : null,
      }));
      console.log('[game-metadata-store] Updated game object:', get().game);
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

    setPlayerMapping: (mapping: { playerId: string; playerIndex: number }[]) => {
      set({ playerMapping: mapping });
    },
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
