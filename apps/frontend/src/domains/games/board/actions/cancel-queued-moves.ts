import { boardStore, setQueuedMoves, setSelectedTile } from '@/domains/games/board-store';

function cancelQueuedMoves(): boolean {
  const { queuedMoves } = boardStore.state.game;
  if (queuedMoves.length === 0) return false;

  const snapTarget = queuedMoves[0].sourceCoord;
  const shouldSnap = !boardStore.state.ui.hasUserSelectedSinceLastQueue;

  setQueuedMoves([]);

  // Snap selection back to where execution reached, unless the user
  // manually selected a different tile (don't interrupt them).
  if (shouldSnap) {
    setSelectedTile(snapTarget);
  }

  return true;
}

export { cancelQueuedMoves };
