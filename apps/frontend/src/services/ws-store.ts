import { create } from 'zustand';

type wsReadyStates =
  | WebSocket['CONNECTING']
  | WebSocket['OPEN']
  | WebSocket['CLOSING']
  | WebSocket['CLOSED'];

interface WsState {
  readyState: wsReadyStates | null;

  setReadyState: (readyState: wsReadyStates) => void;

  getIsConnected: () => boolean;
  getIsConnecting: () => boolean;
  getIsConnectedOrConnecting: () => boolean;
}

const useWsStore = create<WsState>((set, get) => ({
  readyState: null,

  setReadyState: (readyState: wsReadyStates) => set({ readyState }),

  getIsConnected: () => get().readyState === WebSocket.OPEN,
  getIsConnecting: () => get().readyState === WebSocket.CONNECTING,
  getIsConnectedOrConnecting: () => {
    const readyState = get().readyState;
    return readyState === WebSocket.OPEN || readyState === WebSocket.CONNECTING;
  },
}));

// "non-hook" variant
const wsStore = useWsStore;

export { wsStore };
