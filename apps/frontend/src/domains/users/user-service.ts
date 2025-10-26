import type { UserId } from '@kernel/ids';

import { apiService } from '@/services/api-service';

interface User {
  id: UserId;
  username: string;
  user_key: string;
  created_at: string;
}

class UserService {
  async initializeUser(): Promise<User> {
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

  async updateUsername(username: string): Promise<User> {
    const response = await apiService.put('/api/users/me/username', {
      username,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update username');
    }

    return await response.json();
  }
}

const userService = new UserService();

export { userService };
export type { User };
