import { puzzlesWsEffects } from '@/domains/puzzles/ws-effects';

function undoMove(): void {
  puzzlesWsEffects.sendUndoMove();
}

export { undoMove };
