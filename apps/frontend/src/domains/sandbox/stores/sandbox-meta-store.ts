import { create } from 'zustand';

import type { SandboxConfig } from '@protocol/domains/sandbox/server-messages';

// TODO: isPaused and maxTickReached are timeline concepts, not sandbox-specific.
// When replay-edit mode is added, these should move to a shared timeline store
// (or into boardSessionStore) so both sandbox and replay-edit can use them.
type SandboxStatus = 'idle' | 'active';

interface SandboxMetaState {
  status: SandboxStatus;
  isPaused: boolean;
  config: SandboxConfig | null;
  maxTickReached: number;

  actions: {
    setStatus: (status: SandboxStatus) => void;
    setIsPaused: (isPaused: boolean) => void;
    setConfig: (config: SandboxConfig | null) => void;
    updateMaxTick: (tick: number) => void;
    reset: () => void;
  };
}

const useSandboxMetaStore = create<SandboxMetaState>((set) => ({
  status: 'idle',
  isPaused: true,
  config: null,
  maxTickReached: 0,

  actions: {
    setStatus: (status) => set({ status }),
    setIsPaused: (isPaused) => set({ isPaused }),
    setConfig: (config) => set({ config }),
    updateMaxTick: (tick) => set({ maxTickReached: tick }),
    reset: () =>
      set({
        status: 'idle',
        isPaused: true,
        config: null,
        maxTickReached: 0,
      }),
  },
}));

// Selectors
const selectStatus = (state: SandboxMetaState) => state.status;
const selectIsPaused = (state: SandboxMetaState) => state.isPaused;
const selectConfig = (state: SandboxMetaState) => state.config;
const selectMaxTickReached = (state: SandboxMetaState) => state.maxTickReached;

// Helper for accessing actions
const sandboxMetaActions = () => useSandboxMetaStore.getState().actions;

export type { SandboxMetaState };
export { useSandboxMetaStore, sandboxMetaActions };
export { selectStatus, selectIsPaused, selectConfig, selectMaxTickReached };
