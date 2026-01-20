import { puzzlesWsEffects } from '@/domains/puzzles/ws-effects';

function clearMoves(): void {
  puzzlesWsEffects.sendCancelMoves();
}

export { clearMoves };
