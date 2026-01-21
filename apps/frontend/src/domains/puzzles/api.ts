import type { UserPuzzleStats } from '@protocol/domains/puzzles/api-types';

import { apiService } from '@/services/api-service';

async function fetchUserStats(): Promise<UserPuzzleStats> {
  const response = await apiService.get('/api/puzzles/stats');
  if (!response.ok) {
    throw new Error('Failed to fetch puzzle stats');
  }
  return response.json();
}

export { fetchUserStats };
