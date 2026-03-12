import type { Coord, Direction } from '@core/types';

import { queueMoveOnBoard } from '@/domains/games/board-store';
import { puzzlesWsEffects } from '@/domains/puzzles/ws-effects';

function queueMove(source: Coord, direction: Direction): void {
  const didMove = queueMoveOnBoard(source, direction);
  if (didMove) {
    puzzlesWsEffects.sendMoveRequest(source, direction);
  }
}

export { queueMove };
