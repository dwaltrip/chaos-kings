import type { GameState } from '@core/types';
import { processStep } from '@core/step-processor';

import {
  replayActions,
  useReplayStore,
  CHECKPOINT_INTERVAL,
  FRAME_CACHE_MAX_SIZE,
  type ReplayFrame,
} from '@/domains/replay/stores/replay-store';

function deepCloneGameState(gameState: GameState): GameState {
  return {
    tick: gameState.tick,
    players: gameState.players.map((p) => ({ ...p })),
    board: {
      size: { ...gameState.board.size },
      grid: gameState.board.grid.map((row) =>
        row.map((sq) => ({
          ...sq,
          coord: { ...sq.coord },
        })),
      ),
    },
  };
}

function jumpToStep(targetStep: number): void {
  const actions = replayActions();
  const state = useReplayStore.getState();

  if (!state.config || targetStep < 0) return;

  // Check frame cache first
  if (state.frameCache.has(targetStep)) {
    const frame = state.frameCache.get(targetStep)!;

    // Update LRU order
    const newOrder = state.frameCacheOrder.filter((s) => s !== targetStep);
    newOrder.push(targetStep);

    actions.setCurrentFrame(frame);
    actions.updateCache({ frameCacheOrder: newOrder });
    return;
  }

  // Find nearest checkpoint <= targetStep
  let checkpointStep = 0;
  for (const step of state.checkpoints.keys()) {
    if (step <= targetStep && step > checkpointStep) {
      checkpointStep = step;
    }
  }

  const checkpoint = state.checkpoints.get(checkpointStep)!;
  const gameState = deepCloneGameState(checkpoint.gameState);
  let gameEnded = checkpoint.gameEnded;
  let winner = checkpoint.winner;

  const newFrameCache = new Map(state.frameCache);
  const newCheckpoints = new Map(state.checkpoints);
  let newFrameCacheOrder = [...state.frameCacheOrder];
  let newTotalSteps = state.totalSteps;

  // Simulate forward from checkpoint to target
  while (gameState.tick < targetStep && !gameEnded) {
    const nextTick = gameState.tick + 1;
    const events = state.eventsByStep.get(nextTick) ?? [];
    const result = processStep(gameState, events, state.config.timing);

    gameEnded = result.gameEnded;
    winner = result.winnerPlayerIndex;

    const frame: ReplayFrame = {
      gameState: deepCloneGameState(gameState),
      gameEnded,
      winner,
    };

    const currentTick = gameState.tick;

    // Add to frame cache with LRU eviction
    newFrameCache.set(currentTick, frame);
    newFrameCacheOrder = newFrameCacheOrder.filter((s) => s !== currentTick);
    newFrameCacheOrder.push(currentTick);

    // Evict old frames if cache is full (keep checkpoints)
    while (newFrameCacheOrder.length > FRAME_CACHE_MAX_SIZE) {
      const oldest = newFrameCacheOrder.shift()!;
      // Don't evict checkpoints
      if (oldest % CHECKPOINT_INTERVAL !== 0) {
        newFrameCache.delete(oldest);
      }
    }

    // Save checkpoint every N steps
    if (currentTick % CHECKPOINT_INTERVAL === 0) {
      newCheckpoints.set(currentTick, frame);
    }

    // Update total steps if game ended
    if (gameEnded) {
      newTotalSteps = currentTick;
    }
  }

  const finalFrame = newFrameCache.get(gameState.tick)!;

  actions.setCurrentFrame(finalFrame);
  actions.updateCache({
    frameCache: newFrameCache,
    checkpoints: newCheckpoints,
    frameCacheOrder: newFrameCacheOrder,
  });

  if (newTotalSteps !== state.totalSteps) {
    actions.setTotalSteps(newTotalSteps!);
  }
}

export { jumpToStep };
