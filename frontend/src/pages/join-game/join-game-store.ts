import { create } from 'zustand';

interface GameMatchmakingState {
  playersNeeded: number
  queueSize: number
  isInQueue: boolean

  actions: {
    setQueueSize: (size: number) => void;
    setPlayersNeeded: (needed: number) => void;
    setIsInQueue: (isInQueue: boolean) => void;
  };
}

const gameMatchmakingStore = create<GameMatchmakingState>((set) => ({
  playersNeeded: 0,
  queueSize: 0,
  isInQueue: false,

  actions: {
    setQueueSize: (size) => set({ queueSize: size }),
    setPlayersNeeded: (needed) => set({ playersNeeded: needed }),
    setIsInQueue: (isInQueue) => set({ isInQueue }),
  }
}));

export { gameMatchmakingStore };
