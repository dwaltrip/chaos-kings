import { apiService } from '@/services/api-service';

interface User {
  id: number;
  username: string;
  user_key: string;
  created_at: string;
}

class UserService {
  async initializeUser(): Promise<User> {
    try {
      // Try to get existing user
      const response = await apiService.get('/api/users/me');
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Failed to get existing user:', error);
    }

    // Auto-create new user
    const response = await apiService.post('/api/users/auto-create');
    
    if (!response.ok) {
      throw new Error('Failed to create user');
    }
    
    const data = await response.json();
    return data.user;
  }
  
  async updateUsername(username: string): Promise<User> {
    const response = await apiService.put('/api/users/me/username', { username });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update username');
    }
    
    return await response.json();
  }
}

export const userService = new UserService();
export type { User };