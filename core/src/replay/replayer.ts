import type { BoardState } from '@core/types';
import type { GameConfig } from '@core/game-config';
import type { MoveHistoryV1, MoveEvent } from '@core/replay/types';
import { processStep } from '@core/step-processor';

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
  opts?: { maxSteps?: number; stopAfterLastEvent?: boolean },
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

  // Assume steps begin at 1 (1-based)
  let step = 1;
  let lastEventStep = 0;
  for (const e of history.events) {
    if (e.step > lastEventStep) lastEventStep = e.step;
  }

  const maxSteps = opts?.maxSteps ?? Infinity;
  const stopAfterLastEvent = opts?.stopAfterLastEvent ?? false;

  // Iterate until game end, or bounds reached
  while (step <= maxSteps) {
    const events = byStep.get(step) ?? [];
    const result = processStep(board, step, events, config.timing);
    yield {
      step,
      board,
      gameEnded: result.gameEnded,
      winner: result.winnerPlayerIndex,
    };

    if (result.gameEnded && result.winnerPlayerIndex !== undefined) {
      break;
    }
    if (stopAfterLastEvent && step >= lastEventStep) {
      break;
    }
    step += 1;
  }
}

export { replayFrames };
