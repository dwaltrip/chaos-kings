import { useEffect } from 'react';

import { useSandboxMetaStore } from '@/domains/sandbox/stores/sandbox-meta-store';
import { useBoardSessionStore } from '@/domains/games/stores/board-session-store';
import { play, pause, stepForward, stepBack, reset } from '@/domains/sandbox/actions';

interface UseSandboxPlaybackControlsParams {
  disabled: boolean;
}

function useSandboxPlaybackControls({ disabled }: UseSandboxPlaybackControlsParams) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (disabled) return;

      const key = event.key.toLowerCase();
      const isPaused = useSandboxMetaStore.getState().isPaused;
      const tick = useBoardSessionStore.getState().tick;

      switch (key) {
        case ' ':
          event.preventDefault();
          if (isPaused) {
            play();
          } else {
            pause();
          }
          break;

        case 'arrowright':
          event.preventDefault();
          if (isPaused) {
            stepForward();
          }
          break;

        case 'arrowleft':
          event.preventDefault();
          if (isPaused && tick > 0) {
            stepBack();
          }
          break;

        case 'r':
          event.preventDefault();
          reset();
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [disabled]);
}

export { useSandboxPlaybackControls };
