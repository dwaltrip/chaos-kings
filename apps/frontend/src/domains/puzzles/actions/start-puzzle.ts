import { boardStore, initBoard } from '@/domains/games/board-store';
import { usePuzzleStore } from '@/domains/puzzles/stores/puzzle-store';
import { puzzlesWsEffects } from '@/domains/puzzles/ws-effects';

function startPuzzle(): void {
  const { reset } = usePuzzleStore.getState().actions;
  reset();
  boardStore.reset();
  initBoard([], 0);
  puzzlesWsEffects.sendStartPlaying();
}

export { startPuzzle };
