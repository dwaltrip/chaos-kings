import { apiService } from '@/services/api-service';
import { userStore } from '@/domains/users/user-store';

import type { User } from '@/domains/users/types';

async function updateUsername(username: string): Promise<User> {
  const response = await apiService.put('/api/users/me/username', { username });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update username');
  }

  const updatedUser: User = await response.json();
  userStore.setState({ data: updatedUser });
  return updatedUser;
}

export { updateUsername };
