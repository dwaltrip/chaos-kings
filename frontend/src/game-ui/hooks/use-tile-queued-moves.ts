import type { Coord, Movement } from '@core/types';
import { gameplayStore } from '@/game-ui/store/gameplay-store';
import { useShallow } from 'zustand/shallow';

/**
 * Custom hook that provides tile-specific queued moves with proper equality checking
 * to prevent unnecessary re-renders when other tiles' moves change.
 */
export function useTileQueuedMoves(coord: Coord): Set<Movement> {
  const key = `${coord.x},${coord.y}`;
  const result = gameplayStore(
    useShallow((state) => {
      return state.queuedMovesByCoord.get(key) || new Set<Movement>();
    }),
  );

  // Only log when there are actually moves for this tile
  if (result.size > 0) {
    console.log(
      `[useTileQueuedMoves] ${key}: size=${result.size}, values=[${Array.from(result).join(',')}]`,
    );
  }
  return result;
}
