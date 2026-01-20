import { usePuzzleStore } from '@/domains/puzzles/stores/puzzle-store';
import { puzzlesWsEffects } from '@/domains/puzzles/ws-effects';

function startPuzzle(): void {
  const { reset } = usePuzzleStore.getState().actions;
  reset();
  puzzlesWsEffects.sendStartPlaying();
}

export { startPuzzle };
