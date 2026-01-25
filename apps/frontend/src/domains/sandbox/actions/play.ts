import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';

function play(): void {
  sandboxWsEffects.sendPlay();
}

export { play };
