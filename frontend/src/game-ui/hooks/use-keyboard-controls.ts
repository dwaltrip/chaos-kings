import { useEffect, useRef } from 'react';
import {
  KEY_REPEAT_RATE_MS,
  KEY_REPEAT_INITIAL_DELAY_MS,
} from '@/settings/user-interaction-config';

interface UseKeyboardControlsParams {
  onMoveRequest: (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => void;
  onCancelMoves: () => void;
  onUndoMove: () => void;
  disabled: boolean;
}

export function useKeyboardControls({
  onMoveRequest,
  onCancelMoves,
  onUndoMove,
  disabled,
}: UseKeyboardControlsParams) {
  const keyStatesRef = useRef<Map<string, boolean>>(new Map());
  const intervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    const keyStates = keyStatesRef.current;
    const intervals = intervalsRef.current;

    const clearAllIntervals = () => {
      intervals.forEach((interval) => clearInterval(interval));
      intervals.clear();
      keyStates.clear();
    };

    const getDirectionFromKey = (
      key: string,
    ): 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | null => {
      switch (key.toLowerCase()) {
        case 'w':
          return 'UP';
        case 's':
          return 'DOWN';
        case 'a':
          return 'LEFT';
        case 'd':
          return 'RIGHT';
        default:
          return null;
      }
    };

    // TODO: Refactor to use a map. Don't use if / else chains.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (disabled) return;

      const key = event.key.toLowerCase();
      const direction = getDirectionFromKey(key);

      if (direction) {
        event.preventDefault();

        // If this key is already being held, do nothing
        if (keyStates.get(key)) {
          return;
        }

        // Stop any existing repeats (last key wins)
        clearAllIntervals();

        // Mark this key as pressed
        keyStates.set(key, true);

        // Trigger immediate move
        onMoveRequest(direction);

        // Start repeating after initial delay
        const delayTimeout = setTimeout(() => {
          const repeatInterval = setInterval(() => {
            if (disabled || !keyStates.get(key)) {
              clearInterval(repeatInterval);
              intervals.delete(key);
              return;
            }
            onMoveRequest(direction);
          }, KEY_REPEAT_RATE_MS);

          intervals.set(key, repeatInterval);
        }, KEY_REPEAT_INITIAL_DELAY_MS);

        intervals.set(key, delayTimeout);
      } else if (key === 'q') {
        onCancelMoves();
        event.preventDefault();
      } else if (key === 'e') {
        event.preventDefault();
        onUndoMove();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (disabled) return;

      const key = event.key.toLowerCase();
      const direction = getDirectionFromKey(key);

      if (direction) {
        // Mark key as not pressed
        keyStates.set(key, false);

        // Clear the timeout/interval for this key
        const timeoutOrInterval = intervals.get(key);
        if (timeoutOrInterval) {
          clearTimeout(timeoutOrInterval);
          clearInterval(timeoutOrInterval);
          intervals.delete(key);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      clearAllIntervals();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onMoveRequest, onCancelMoves, disabled]);
}
