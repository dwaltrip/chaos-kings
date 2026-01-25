import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';

function clearMoves(): void {
  sandboxWsEffects.sendCancelMoves();
}

export { clearMoves };
