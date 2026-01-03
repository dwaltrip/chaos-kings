import type { User } from '@/domains/users/types';
// import { apiService } from '@/services/api-service';

function startPlayingPuzzles(user: User) {
  console.log('startPlayingPuzzles:', user.username);
  // const resp = apiService.post('puzzles');
}

export { startPlayingPuzzles };
