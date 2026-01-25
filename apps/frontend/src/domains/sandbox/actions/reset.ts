import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';

function reset(): void {
  sandboxWsEffects.sendReset();
}

export { reset };
