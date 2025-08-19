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

const selectIsConnected = (state: WsState) =>
  state.readyState === WebSocket.OPEN;
const selectIsConnecting = (state: WsState) =>
  state.readyState === WebSocket.CONNECTING;
const selectIsConnectedOrConnecting = (state: WsState) =>
  state.readyState === WebSocket.OPEN ||
  state.readyState === WebSocket.CONNECTING;

// "non-hook" variant
const wsStore = useWsStore;

export {
  useWsStore,
  wsStore,
  selectIsConnected,
  selectIsConnecting,
  selectIsConnectedOrConnecting,
};
