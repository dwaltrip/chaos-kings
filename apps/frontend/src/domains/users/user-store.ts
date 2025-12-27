import { createAsyncStore } from '@/utils/create-async-store';

import type { User } from '@/domains/users/types';

const userStore = createAsyncStore<User>();

type UserState = ReturnType<typeof userStore.getState>;

// Convenience selectors

const selectUser = (state: UserState): User | null => state.data;

const selectIsLoading = (state: UserState): boolean => state.loading;

const selectIsReady = (state: UserState): boolean => state.isReady();

export type { User };
export { userStore, selectUser, selectIsLoading, selectIsReady };
