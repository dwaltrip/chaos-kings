class ApiService {
  private baseUrl = 'http://localhost:3131';

  async get(path: string, options?: RequestInit): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      credentials: 'include',
      ...options
    });
  }

  async post(path: string, data?: any, options?: RequestInit): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      credentials: 'include',
      body: JSON.stringify(data || {}),
      ...options
    });
  }

  async put(path: string, data?: any, options?: RequestInit): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined,
      ...options
    });
  }

  async delete(path: string, options?: RequestInit): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      credentials: 'include',
      ...options
    });
  }
}

export const apiService = new ApiService();