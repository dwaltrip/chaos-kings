import { useReplayStore } from '@/domains/replay/stores/replay-store';
import {
  play,
  pause,
  stepForward,
  stepBackward,
  restart,
} from '@/domains/replay/actions';

function ReplayControls() {
  const isPlaying = useReplayStore((state) => state.isPlaying);
  const currentStep = useReplayStore((state) => state.currentStep);
  const totalSteps = useReplayStore((state) => state.totalSteps);
  const gameEnded = useReplayStore((state) => state.currentFrame?.gameEnded ?? false);

  return (
    <div className="replay-controls flex items-center gap-4 p-4 bg-gray-800 rounded-lg">
      <button
        onClick={restart}
        className="px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-white"
        title="Restart"
      >
        ⏮
      </button>

      <button
        onClick={stepBackward}
        disabled={currentStep <= 0}
        className="px-3 py-2 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
        title="Step Backward"
      >
        ⏪
      </button>

      {isPlaying ? (
        <button
          onClick={pause}
          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded text-white font-bold"
          title="Pause"
        >
          ⏸ Pause
        </button>
      ) : (
        <button
          onClick={play}
          disabled={gameEnded}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white font-bold"
          title="Play"
        >
          ▶ Play
        </button>
      )}

      <button
        onClick={stepForward}
        disabled={gameEnded}
        className="px-3 py-2 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white"
        title="Step Forward"
      >
        ⏩
      </button>

      <div className="text-white ml-4">
        Step: {currentStep} {totalSteps !== null && `/ ~${totalSteps}`}
        {gameEnded && <span className="ml-2 text-green-400">(Game Ended)</span>}
      </div>
    </div>
  );
}

export { ReplayControls };
