import type { BoardState } from '@core/types';
import type { MoveEvent, MoveHistoryV1 } from '@core/replay/types';

import { loadGame, GameNotFoundError } from '@/domains/games/games-api';
import { replayActions, type ReplayFrame } from '@/domains/replay/stores/replay-store';

function groupEventsByStep(events: MoveEvent[]): Map<number, MoveEvent[]> {
  const map = new Map<number, MoveEvent[]>();
  for (const e of events) {
    const list = map.get(e.step) ?? [];
    list.push(e);
    map.set(e.step, list);
  }
  return map;
}

function getLastEventStep(events: MoveEvent[]): number {
  let lastStep = 0;
  for (const e of events) {
    if (e.step > lastStep) lastStep = e.step;
  }
  return lastStep;
}

async function loadReplay(gameId: string): Promise<void> {
  const actions = replayActions();
  const state = actions.getState();

  // Don't reload if same game
  if (state.gameId === gameId && state.config) {
    return;
  }

  // Stop any existing playback
  if (state.playIntervalId) {
    clearInterval(state.playIntervalId);
    actions.setPlayIntervalId(null);
  }

  actions.setLoading(true);
  actions.setError(null);
  actions.setState({ gameId, isPlaying: false });

  try {
    const game = await loadGame(gameId);

    if (!game.move_history) {
      actions.setLoading(false);
      actions.setError('Replay not available for this game');
      return;
    }

    const history = game.move_history as MoveHistoryV1;
    const config = game.config;
    const eventsByStep = groupEventsByStep(history.events);
    const lastEventStep = getLastEventStep(history.events);

    // Build player info
    const players = game.players.map((p) => ({
      username: (p as any).username,
      playerIndex: p.player_index,
    }));

    // Create initial board state (step 0 - before any moves)
    const initialBoard: BoardState = {
      size: config.map.size,
      grid: config.startingGrid.map((row) =>
        row.map((sq) => ({
          ...sq,
          coord: { ...sq.coord },
        })),
      ),
    };

    const initialFrame: ReplayFrame = {
      step: 0,
      board: initialBoard,
      gameEnded: false,
    };

    // Initialize checkpoints with step 0
    const checkpoints = new Map<number, ReplayFrame>();
    checkpoints.set(0, initialFrame);

    actions.setGameData({
      gameId,
      config,
      history,
      players,
      eventsByStep,
      totalSteps: lastEventStep,
    });

    actions.updateCache({
      checkpoints,
      frameCache: new Map([[0, initialFrame]]),
      frameCacheOrder: [0],
    });

    actions.setCurrentFrame(initialFrame);
    actions.setLoading(false);
  } catch (err) {
    let errorMessage = 'Failed to load replay';
    if (err instanceof GameNotFoundError) {
      errorMessage = 'Game not found';
    }
    console.error(`Error loading replay (gameId=${gameId}):`, err);
    actions.setLoading(false);
    actions.setError(errorMessage);
  }
}

export { loadReplay };
