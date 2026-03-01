import { useState, useEffect, useCallback } from 'react';

function useFrameNav(maxIndex: number) {
  const [frameIndex, setFrameIndex] = useState(0);

  const stepBack = useCallback(() => {
    setFrameIndex((i) => Math.max(0, i - 1));
  }, []);

  const stepForward = useCallback(() => {
    setFrameIndex((i) => Math.min(maxIndex, i + 1));
  }, [maxIndex]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        stepBack();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        stepForward();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [stepBack, stepForward]);

  return { frameIndex, stepBack, stepForward };
}

export { useFrameNav };
