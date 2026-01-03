import type { User } from '@/domains/users/types';
import { puzzlesWsEffects } from '@/domains/puzzles/ws-effects';

function startPlayingPuzzles(user: User) {
  console.log('startPlayingPuzzles:', user.username);
  puzzlesWsEffects.sendStartPlaying();
}

export { startPlayingPuzzles };
