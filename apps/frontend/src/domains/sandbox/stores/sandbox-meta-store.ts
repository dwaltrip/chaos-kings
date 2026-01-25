import { create } from 'zustand';

import type { SandboxConfig } from '@protocol/domains/sandbox/server-messages';

type SandboxStatus = 'idle' | 'active';

interface SandboxMetaState {
  status: SandboxStatus;
  isPaused: boolean;
  config: SandboxConfig | null;

  actions: {
    setStatus: (status: SandboxStatus) => void;
    setIsPaused: (isPaused: boolean) => void;
    setConfig: (config: SandboxConfig | null) => void;
    reset: () => void;
  };
}

const useSandboxMetaStore = create<SandboxMetaState>((set) => ({
  status: 'idle',
  isPaused: true,
  config: null,

  actions: {
    setStatus: (status) => set({ status }),
    setIsPaused: (isPaused) => set({ isPaused }),
    setConfig: (config) => set({ config }),
    reset: () =>
      set({
        status: 'idle',
        isPaused: true,
        config: null,
      }),
  },
}));

// Selectors
const selectStatus = (state: SandboxMetaState) => state.status;
const selectIsPaused = (state: SandboxMetaState) => state.isPaused;
const selectConfig = (state: SandboxMetaState) => state.config;

// Helper for accessing actions
const sandboxMetaActions = () => useSandboxMetaStore.getState().actions;

export type { SandboxMetaState };
export { useSandboxMetaStore, sandboxMetaActions };
export { selectStatus, selectIsPaused, selectConfig };
