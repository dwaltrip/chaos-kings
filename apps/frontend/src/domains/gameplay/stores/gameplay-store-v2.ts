import { create } from 'zustand';

import type { PlayerIndex } from '@core/types';
import { isEnded } from '@core/game';

import type { GameWithPlayers, Player } from '@platform/domains/games/types';
import { UserId } from '@kernel/ids';

import {
  gameplayPageStore,
  selectGame,
} from '@/domains/gameplay/stores/gameplay-page-store';

interface GameplayStateV2 {
  game: GameWithPlayers | null;
  gameplayReady: boolean;

  // Player identity (set once at game load)
  players: Player[];
  playersByIndex: Map<PlayerIndex, Player>;
  playersByUserId: Map<UserId, Player>;
  currentPlayerIndex: PlayerIndex | null;
  currentPlayer: Player | null;

  actions: {
    setGameplayReady: (ready: boolean) => void;
    setPlayerData: (players: Player[], currentUserId: UserId | null) => void;
  };
}

const useGameplayStoreV2 = create<GameplayStateV2>((set, get) => {
  const syncGame = () => {
    const newGame = selectGame(gameplayPageStore.getState());
    if (newGame !== get().game) {
      set({ game: newGame || null });
    }
  };

  gameplayPageStore.subscribe(syncGame);

  const game = selectGame(gameplayPageStore.getState()) || null;
  return {
    game,
    gameplayReady: false,

    // Player identity
    players: [],
    playersByIndex: new Map<PlayerIndex, Player>(),
    playersByUserId: new Map<UserId, Player>(),
    currentPlayerIndex: null,
    currentPlayer: null,

    actions: {
      setGameplayReady: (ready) => set({ gameplayReady: ready }),
      setPlayerData: (players: Player[], currentUserId: UserId | null) => {
        const playersByIndex = new Map(players.map((p) => [p.player_index, p]));
        const playersByUserId = new Map(players.map((p) => [p.user_id, p]));
        const currentPlayer = currentUserId
          ? (playersByUserId.get(currentUserId) ?? null)
          : null;

        set({
          players,
          playersByIndex,
          playersByUserId,
          currentPlayer,
          currentPlayerIndex: currentPlayer?.player_index ?? null,
        });
      },
    },
  };
});

// ----------- Selectors -----------

function useGameplayGame(state: GameplayStateV2) {
  return state.game;
}

function useIsGameEnded(state: GameplayStateV2) {
  const { game } = state;
  return game ? isEnded(game) : false;
}

// ---------------------------------

const gameplayActions = () => useGameplayStoreV2.getState().actions;

// ---------------------------------

export type { GameplayStateV2 };
export { useGameplayStoreV2, gameplayActions, useGameplayGame, useIsGameEnded };
