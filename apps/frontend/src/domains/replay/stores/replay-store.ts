import { create } from 'zustand';

import type { GameId } from '@kernel/ids';
import type { GameState } from '@core/types';
import type { GameConfig } from '@core/game-config';
import type { MoveEvent, MoveHistoryV1 } from '@core/replay/types';

const CHECKPOINT_INTERVAL = 25;
const FRAME_CACHE_MAX_SIZE = 100;

interface ReplayFrame {
  gameState: GameState;
  gameEnded: boolean;
  winner?: number;
}

interface ReplayState {
  // Loading state
  loading: boolean;
  error: string | null;

  // Game data
  gameId: GameId | null;
  config: GameConfig | null;
  history: MoveHistoryV1 | null;
  players: { username?: string; playerIndex: number }[];

  // Playback state
  currentStep: number;
  isPlaying: boolean;
  totalSteps: number | null;

  // Current frame for rendering
  currentFrame: ReplayFrame | null;

  // Internal caching
  checkpoints: Map<number, ReplayFrame>;
  frameCache: Map<number, ReplayFrame>;
  frameCacheOrder: number[];
  eventsByStep: Map<number, MoveEvent[]>;
  playIntervalId: number | null;
}

const initialState: Omit<ReplayState, never> = {
  loading: false,
  error: null,
  gameId: null,
  config: null,
  history: null,
  players: [],
  currentStep: 0,
  isPlaying: false,
  totalSteps: null,
  currentFrame: null,
  checkpoints: new Map(),
  frameCache: new Map(),
  frameCacheOrder: [],
  eventsByStep: new Map(),
  playIntervalId: null,
};

const useReplayStore = create<ReplayState>()(() => ({ ...initialState }));

function replayActions() {
  return {
    setState: useReplayStore.setState,
    getState: useReplayStore.getState,

    setLoading: (loading: boolean) => useReplayStore.setState({ loading }),
    setError: (error: string | null) => useReplayStore.setState({ error }),

    setGameData: (data: {
      gameId: GameId;
      config: GameConfig;
      history: MoveHistoryV1;
      players: { username?: string; playerIndex: number }[];
      eventsByStep: Map<number, MoveEvent[]>;
      totalSteps: number;
    }) => {
      useReplayStore.setState({
        gameId: data.gameId,
        config: data.config,
        history: data.history,
        players: data.players,
        eventsByStep: data.eventsByStep,
        totalSteps: data.totalSteps,
      });
    },

    setCurrentFrame: (frame: ReplayFrame) => {
      useReplayStore.setState({
        currentStep: frame.gameState.tick,
        currentFrame: frame,
      });
    },

    setIsPlaying: (isPlaying: boolean) => useReplayStore.setState({ isPlaying }),
    setPlayIntervalId: (id: number | null) =>
      useReplayStore.setState({ playIntervalId: id }),
    setTotalSteps: (totalSteps: number) => useReplayStore.setState({ totalSteps }),

    updateCache: (updates: {
      checkpoints?: Map<number, ReplayFrame>;
      frameCache?: Map<number, ReplayFrame>;
      frameCacheOrder?: number[];
    }) => {
      useReplayStore.setState(updates);
    },

    reset: () => {
      const state = useReplayStore.getState();
      if (state.playIntervalId) {
        clearInterval(state.playIntervalId);
      }
      useReplayStore.setState({ ...initialState });
    },
  };
}

export type { ReplayFrame, ReplayState };
export { useReplayStore, replayActions, CHECKPOINT_INTERVAL, FRAME_CACHE_MAX_SIZE };
