import { create } from 'zustand';

import type { GameWithPlayers } from '@common/types/games';
import {
  loadGame as apiLoadGame,
  GameNotFoundError,
} from '@/pages/game/games-api';

interface GameMetadataState {
  // Static metadata from API
  game: GameWithPlayers | null;
  loading: boolean;
  error: string | null;

  // Game start countdown
  countdownActive: boolean;
  countdownSeconds: number;

  // Dynamic gameplay metadata (updated by GameUI)
  isGameEnded: boolean;
  winner: number | null;
  endReason: 'general_captured' | 'timeout' | 'disconnect' | null;
  playerMapping: { playerId: string; playerIndex: number }[] | null;

  // Actions
  actions: {
    loadGame: (gameId: string) => Promise<void>;
    setGame: (game: GameWithPlayers) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setCountdownActive: (active: boolean) => void;
    setCountdownSeconds: (seconds: number) => void;
    setGameEnded: (
      winner: number,
      reason: 'general_captured' | 'timeout' | 'disconnect',
    ) => void;
    setPlayerMapping: (
      mapping: { playerId: string; playerIndex: number }[],
    ) => void;
    reset: () => void;
  };
}

const gameMetadataStore = create<GameMetadataState>((set) => ({
  // Static metadata
  game: null,
  loading: false,
  error: null,

  // Game start countdown
  countdownActive: false,
  countdownSeconds: 5,

  // Dynamic gameplay metadata
  isGameEnded: false,
  winner: null,
  endReason: null,
  playerMapping: null,

  actions: {
    loadGame: async (gameId: string) => {
      try {
        set({ loading: true, error: null });
        const game = await apiLoadGame(gameId);
        set({ game, loading: false });
      } catch (err) {
        let errorMessage = 'Failed to load game';
        if (err instanceof GameNotFoundError) {
          errorMessage = 'Game not found';
        }
        console.error('Error loading game:', err);
        set({ error: errorMessage, loading: false });
      }
    },

    setGame: (game: GameWithPlayers) => {
      set({ game });
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

    setGameEnded: (
      winner: number,
      reason: 'general_captured' | 'timeout' | 'disconnect',
    ) => {
      set({
        isGameEnded: true,
        winner,
        endReason: reason,
      });
    },

    setPlayerMapping: (
      mapping: { playerId: string; playerIndex: number }[],
    ) => {
      set({ playerMapping: mapping });
    },

    reset: () => {
      set({
        game: null,
        loading: false,
        error: null,
        countdownActive: false,
        countdownSeconds: 5,
        isGameEnded: false,
        winner: null,
        endReason: null,
        playerMapping: null,
      });
    },
  },
}));

export { gameMetadataStore };
