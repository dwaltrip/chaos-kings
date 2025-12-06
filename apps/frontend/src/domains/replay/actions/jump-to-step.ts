import type { BoardState } from '@core/types';
import { processStep } from '@core/step-processor';

import {
  replayActions,
  useReplayStore,
  CHECKPOINT_INTERVAL,
  FRAME_CACHE_MAX_SIZE,
  type ReplayFrame,
} from '@/domains/replay/stores/replay-store';

function deepCloneBoard(board: BoardState): BoardState {
  return {
    size: { ...board.size },
    grid: board.grid.map((row) =>
      row.map((sq) => ({
        ...sq,
        coord: { ...sq.coord },
      })),
    ),
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
  let board = deepCloneBoard(checkpoint.board);
  let currentStep = checkpointStep;
  let gameEnded = checkpoint.gameEnded;
  let winner = checkpoint.winner;

  const newFrameCache = new Map(state.frameCache);
  const newCheckpoints = new Map(state.checkpoints);
  let newFrameCacheOrder = [...state.frameCacheOrder];
  let newTotalSteps = state.totalSteps;

  // Simulate forward from checkpoint to target
  while (currentStep < targetStep && !gameEnded) {
    currentStep++;
    const events = state.eventsByStep.get(currentStep) ?? [];
    const result = processStep(board, currentStep, events, state.config.timing);

    gameEnded = result.gameEnded;
    winner = result.winnerPlayerIndex;

    const frame: ReplayFrame = {
      step: currentStep,
      board: deepCloneBoard(board),
      gameEnded,
      winner,
    };

    // Add to frame cache with LRU eviction
    newFrameCache.set(currentStep, frame);
    newFrameCacheOrder = newFrameCacheOrder.filter((s) => s !== currentStep);
    newFrameCacheOrder.push(currentStep);

    // Evict old frames if cache is full (keep checkpoints)
    while (newFrameCacheOrder.length > FRAME_CACHE_MAX_SIZE) {
      const oldest = newFrameCacheOrder.shift()!;
      // Don't evict checkpoints
      if (oldest % CHECKPOINT_INTERVAL !== 0) {
        newFrameCache.delete(oldest);
      }
    }

    // Save checkpoint every N steps
    if (currentStep % CHECKPOINT_INTERVAL === 0) {
      newCheckpoints.set(currentStep, frame);
    }

    // Update total steps if game ended
    if (gameEnded) {
      newTotalSteps = currentStep;
    }
  }

  const finalFrame = newFrameCache.get(currentStep)!;

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
