import { createAsyncStore } from '@/utils/create-async-store';

import type { User } from '@/domains/users/types';

const userStore = createAsyncStore<User>();

type UserState = ReturnType<typeof userStore.getState>;

// Convenience selectors

const selectUser = (state: UserState): User | null => state.data;

const selectIsLoading = (state: UserState): boolean => state.isLoading();

const selectIsReady = (state: UserState): boolean => state.isReady();

const selectError = (state: UserState): Error | null => state.error;

export type { User };
export { userStore, selectUser, selectIsLoading, selectIsReady, selectError };
