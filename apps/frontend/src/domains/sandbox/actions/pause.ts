import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';

function pause(): void {
  sandboxWsEffects.sendPause();
}

export { pause };
