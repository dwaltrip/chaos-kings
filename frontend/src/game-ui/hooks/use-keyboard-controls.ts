import { useEffect } from 'react';

interface UseKeyboardControlsParams {
  onMoveRequest: (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => void;
  onCancelMoves: () => void;
  disabled: boolean;
}

export function useKeyboardControls({
  onMoveRequest,
  onCancelMoves,
  disabled,
}: UseKeyboardControlsParams) {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (disabled) return;

      switch (event.key.toLowerCase()) {
        case 'w':
          onMoveRequest('UP');
          event.preventDefault();
          break;
        case 's':
          onMoveRequest('DOWN');
          event.preventDefault();
          break;
        case 'a':
          onMoveRequest('LEFT');
          event.preventDefault();
          break;
        case 'd':
          onMoveRequest('RIGHT');
          event.preventDefault();
          break;
        case 'q':
          onCancelMoves();
          event.preventDefault();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onMoveRequest, onCancelMoves, disabled]);
}
