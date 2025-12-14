import { create } from 'zustand';

import type { GameId } from '@kernel/ids';
import { isEnded } from '@core/game';
import { PRE_GAME_COUNTDOWN_SECONDS } from '@core/ui-timing-config';
import type { GameWithPlayers } from '@platform/domains/games/types';

import type { LoaderActions, LoaderState } from '@/utils/create-loader-slice';
import { createLoaderSlice } from '@/utils/create-loader-slice';

interface GameplayPageState {
  game: GameWithPlayers | null;
  countdownActive: boolean;
  countdownSeconds: number;
  // TODO: should derive `winner` from game object instead of separate state
  winner: number | null;
  loader: LoaderState<GameId>;
  isGameEnded: () => boolean;
  actions: {
    setGame: (game: GameWithPlayers) => void;
    updateGame: (updates: Partial<GameWithPlayers>) => void;
    setCountdownActive: (active: boolean) => void;
    setCountdownSeconds: (seconds: number) => void;
    setWinner: (winner: number) => void;
    reset: () => void;
    loader: LoaderActions<GameId>;
  };
}

const { initial: loaderInitial, actions: loaderActions } = createLoaderSlice<GameId>();

const initialState = {
  game: null as GameWithPlayers | null,
  countdownActive: false,
  countdownSeconds: PRE_GAME_COUNTDOWN_SECONDS,
  winner: null as number | null,
  loader: loaderInitial,
};

const gameplayPageStore = create<GameplayPageState>((set, get) => ({
  ...initialState,
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
    },
    setCountdownActive: (active: boolean) => {
      set({ countdownActive: active });
    },
    setCountdownSeconds: (seconds: number) => {
      set({ countdownSeconds: seconds });
    },
    setWinner: (winner: number) => set({ winner }),
    reset: () => set({ ...initialState }),
    loader: loaderActions(
      (updates) => set((state) => ({ loader: { ...state.loader, ...updates } })),
      () => get().loader,
    ),
  },
}));

function useIsGameEnded(state: GameplayPageState): boolean {
  return state.isGameEnded();
}

// TODO: resolve duplication of this in gameplay-store-v2
const useGameplayPageStore = gameplayPageStore;

export { gameplayPageStore, useGameplayPageStore, useIsGameEnded };
