import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';

function stepForward(): void {
  sandboxWsEffects.sendStepForward();
}

export { stepForward };
