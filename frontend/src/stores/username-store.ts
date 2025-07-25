import { create } from 'zustand';
import { saveToLocalStorage, loadFromLocalStorage, storageKeys } from '@/utils/local-storage';

interface UsernameState {
  username: string;
  isLoading: boolean;
  actions: {
    setUsername: (username: string) => void;
    loadUsername: () => void;
    clearUsername: () => void;
  };
}

export const usernameStore = create<UsernameState>((set) => ({
  username: '',
  isLoading: false,
  actions: {
    setUsername: (username: string) => {
      const trimmedUsername = username.trim();
      set({ username: trimmedUsername });
      saveToLocalStorage(storageKeys.USERNAME, trimmedUsername);
    },
    loadUsername: () => {
      set({ isLoading: true });
      const savedUsername = loadFromLocalStorage<string>(storageKeys.USERNAME);
      set({ 
        username: savedUsername || '', 
        isLoading: false 
      });
    },
    clearUsername: () => {
      set({ username: '' });
      saveToLocalStorage(storageKeys.USERNAME, '');
    },
  }
}));

// Auto-load username on store initialization
usernameStore.getState().actions.loadUsername();