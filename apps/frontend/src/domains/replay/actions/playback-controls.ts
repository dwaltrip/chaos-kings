import { replayActions, useReplayStore } from '@/domains/replay/stores/replay-store';
import { jumpToStep } from '@/domains/replay/actions/jump-to-step';

function play(): void {
  const actions = replayActions();
  const state = useReplayStore.getState();

  if (state.isPlaying || !state.config) return;

  // Don't play if game already ended
  if (state.currentFrame?.gameEnded) return;

  const tickRateMs = state.config.timing.tickRateMs;

  const intervalId = window.setInterval(() => {
    const current = useReplayStore.getState();
    if (current.currentFrame?.gameEnded) {
      pause();
      return;
    }
    stepForward();
  }, tickRateMs);

  actions.setIsPlaying(true);
  actions.setPlayIntervalId(intervalId);
}

function pause(): void {
  const actions = replayActions();
  const state = useReplayStore.getState();

  if (state.playIntervalId) {
    clearInterval(state.playIntervalId);
  }

  actions.setIsPlaying(false);
  actions.setPlayIntervalId(null);
}

function stepForward(): void {
  const state = useReplayStore.getState();
  if (!state.config || state.currentFrame?.gameEnded) return;

  const targetStep = state.currentStep + 1;
  jumpToStep(targetStep);
}

function stepBackward(): void {
  const state = useReplayStore.getState();
  if (!state.config || state.currentStep <= 0) return;

  // Pause if playing
  if (state.isPlaying) {
    pause();
  }

  const targetStep = state.currentStep - 1;
  jumpToStep(targetStep);
}

function restart(): void {
  const state = useReplayStore.getState();
  if (!state.config) return;

  // Pause if playing
  if (state.isPlaying) {
    pause();
  }

  jumpToStep(0);
}

export { play, pause, stepForward, stepBackward, restart };
