import { boardStore } from '@/domains/games/board-store';
import { useBoardState } from '@/domains/games/board-store/hooks';
import {
  useSandboxMetaStore,
  selectIsPaused,
  selectMaxTickReached,
} from '@/domains/sandbox/stores/sandbox-meta-store';
import { play, pause, stepForward, stepBack, reset } from '@/domains/sandbox/actions';

import './sandbox-control-bar.css';

function SandboxControlBar() {
  const boardState = useBoardState(boardStore);
  const tick = boardState.game.tick;
  const isPaused = useSandboxMetaStore(selectIsPaused);
  const maxTickReached = useSandboxMetaStore(selectMaxTickReached);

  const handlePlayPause = () => {
    if (isPaused) {
      play();
    } else {
      pause();
    }
  };

  return (
    <div className="sandbox-control-bar">
      <div className="sandbox-controls">
        <button
          className="sandbox-btn"
          onClick={stepBack}
          disabled={!isPaused || tick === 0}
          title="Step back (Left Arrow)"
        >
          {'<'}
        </button>

        <button
          className="sandbox-btn sandbox-btn-play"
          onClick={handlePlayPause}
          title={isPaused ? 'Play (Space)' : 'Pause (Space)'}
        >
          {isPaused ? 'Play' : 'Pause'}
        </button>

        <button
          className="sandbox-btn"
          onClick={stepForward}
          disabled={!isPaused}
          title="Step forward (Right Arrow)"
        >
          {'>'}
        </button>
      </div>

      <div className="sandbox-separator" />

      <button className="sandbox-btn" onClick={reset} title="Reset to tick 0 (R)">
        Reset
      </button>

      <div className="sandbox-separator" />

      <div className="sandbox-tick-display">
        Tick: {tick} / {maxTickReached}
      </div>
    </div>
  );
}

export { SandboxControlBar };
