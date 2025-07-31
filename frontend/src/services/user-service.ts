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
      const response = await fetch('/api/users/me', {
        credentials: 'include'
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Failed to get existing user:', error);
    }

    // Auto-create new user
    const response = await fetch('/api/users/auto-create', {
      method: 'POST',
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to create user');
    }
    
    const data = await response.json();
    return data.user;
  }
  
  async updateUsername(username: string): Promise<User> {
    const response = await fetch('/api/users/me/username', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update username');
    }
    
    return await response.json();
  }
}

export const userService = new UserService();
export type { User };