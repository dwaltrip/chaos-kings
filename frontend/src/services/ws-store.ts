import { create } from 'zustand';

interface WsState {
  isConnected: boolean;
  actions: {
    setIsConnected: (isConnected: boolean) => void;
  };
}

const wsStore = create<WsState>((set) => ({
  isConnected: false,
  actions: {
    setIsConnected: (isConnected: boolean) => set({ isConnected }),
  },
}));

const useWsStore = () => wsStore();

// Legacy compatibility - can be removed after updating websocket-service.ts
const WsStore = {
  getIsConnected: () => wsStore.getState().isConnected,
  setIsConnected: (isConnected: boolean) =>
    wsStore.getState().actions.setIsConnected(isConnected),
  getState: () => ({ isConnected: wsStore.getState().isConnected }),
};

export { WsStore, useWsStore, wsStore };
