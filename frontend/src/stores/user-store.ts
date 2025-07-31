import { create } from 'zustand';
import { userService, type User } from '@/services/user-service';

interface UserState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  actions: {
    initializeUser(): Promise<void>;
    updateUsername(username: string): Promise<void>;
    clearUser(): void;
  };
}

export const userStore = create<UserState>((set) => ({
  user: null,
  isLoading: false,
  isInitialized: false,
  actions: {
    initializeUser: async () => {
      set({ isLoading: true });
      try {
        const user = await userService.initializeUser();
        set({ user, isLoading: false, isInitialized: true });
      } catch (error) {
        console.error('Failed to initialize user:', error);
        set({ isLoading: false, isInitialized: true });
      }
    },
    
    updateUsername: async (username: string) => {
      set({ isLoading: true });
      try {
        const updatedUser = await userService.updateUsername(username);
        set({ user: updatedUser, isLoading: false });
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },
    
    clearUser: () => {
      set({ user: null, isInitialized: false });
    }
  }
}));