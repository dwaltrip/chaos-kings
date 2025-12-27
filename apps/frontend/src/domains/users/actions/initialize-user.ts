import { apiService } from '@/services/api-service';
import { userStore } from '@/domains/users/user-store';

import type { User } from '@/domains/users/types';

async function fetchUser(): Promise<User> {
  const meResponse = await apiService.get('/api/users/me');
  if (meResponse.ok) {
    const data = await meResponse.json();
    if (data.user) {
      return data.user;
    }
  }

  // If user from "me" API is null, we need to auto-create new user
  const createResponse = await apiService.post('/api/users/auto-create');
  if (!createResponse.ok) {
    throw new Error('Failed to create user');
  }

  const data = await createResponse.json();
  return data.user;
}

async function initializeUser(): Promise<User> {
  return userStore.getState().load(fetchUser);
}

export { initializeUser };
