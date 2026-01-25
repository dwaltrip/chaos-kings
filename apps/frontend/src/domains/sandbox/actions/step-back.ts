import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';

function stepBack(): void {
  sandboxWsEffects.sendStepBack();
}

export { stepBack };
