import { create } from 'zustand';

interface GameMatchmakingState {
  playersNeeded: number;
  queueSize: number;
  isInQueue: boolean;
  gameReady: boolean;
  gameId: number | null;

  actions: {
    setQueueSize: (size: number) => void;
    setPlayersNeeded: (needed: number) => void;
    setIsInQueue: (isInQueue: boolean) => void;
    setGameReady: (gameId: number) => void;
    resetGameState: () => void;
  };
}

const gameMatchmakingStore = create<GameMatchmakingState>((set) => ({
  playersNeeded: 0,
  queueSize: 0,
  isInQueue: false,
  gameReady: false,
  gameId: null,

  actions: {
    setQueueSize: (size) => set({ queueSize: size }),
    setPlayersNeeded: (needed) => set({ playersNeeded: needed }),
    setIsInQueue: (isInQueue) => set({ isInQueue }),
    setGameReady: (gameId) => set({ gameReady: true, gameId }),
    resetGameState: () =>
      set({ gameReady: false, gameId: null, isInQueue: false }),
  },
}));

export { gameMatchmakingStore };
