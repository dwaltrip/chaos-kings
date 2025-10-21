import { create } from 'zustand';

import { ConnectionState } from './types';

type WsConnectionStore = {
  readyState: ConnectionState;
  reconnectAttempts: number;
  isConnected: boolean;
  isConnecting: boolean;
  setReadyState: (state: ConnectionState) => void;
  setReconnectAttempts: (attempts: number) => void;
};

const useWsConnectionStore = create<WsConnectionStore>((set) => ({
  readyState: ConnectionState.CLOSED,
  reconnectAttempts: 0,
  isConnected: false,
  isConnecting: false,
  setReadyState: (state) =>
    set({
      readyState: state,
      isConnected: state === ConnectionState.OPEN,
      isConnecting: state === ConnectionState.CONNECTING,
    }),
  setReconnectAttempts: (attempts) => set({ reconnectAttempts: attempts }),
}));

export { useWsConnectionStore };
