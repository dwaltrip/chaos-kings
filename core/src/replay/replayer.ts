import type { BoardState } from '@core/types';
import type { GameConfig } from '@core/game-config';
import type { MoveHistoryV1, MoveEvent } from '@core/replay/types';
import { processTick } from '@core/step-processor';

function deepCloneBoard(starting: BoardState): BoardState {
  return {
    size: { ...starting.size },
    grid: starting.grid.map((row) =>
      row.map((sq) => ({ ...sq, coord: { ...sq.coord } }) as any),
    ),
  };
}

function groupEventsByStep(events: MoveEvent[]): Map<number, MoveEvent[]> {
  const map = new Map<number, MoveEvent[]>();
  for (const e of events) {
    const list = map.get(e.step) ?? [];
    list.push(e);
    map.set(e.step, list);
  }
  return map;
}

function* replayFrames(
  config: GameConfig,
  history: MoveHistoryV1,
): Iterable<{
  step: number;
  board: BoardState;
  gameEnded: boolean;
  winner?: number;
}> {
  const board = deepCloneBoard({
    size: config.size,
    grid: config.startingGrid,
  });
  const byStep = groupEventsByStep(history.events);

  // Assume steps begin at 1 and advance until game end or no more events
  let step = 1;
  while (true) {
    const events = byStep.get(step) ?? [];
    const result = processTick(board, step, events, config.timing);
    yield {
      step,
      board,
      gameEnded: result.gameEnded,
      winner: result.winnerPlayerIndex,
    };

    if (result.gameEnded && result.winnerPlayerIndex !== undefined) {
      break;
    }
    // Stop when we have no more events to apply for a long time? For MVP, run until game end.
    // In practice the caller decides how many frames to iterate.
    step += 1;
  }
}

export { replayFrames };
