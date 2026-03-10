import type { Coord, Direction } from '@core/types';

import { queueMoveOnBoard } from '@/domains/games/board/actions';
import { sandboxWsEffects } from '@/domains/sandbox/ws-effects';

function queueMove(selectedTile: Coord, direction: Direction): void {
  const didMove = queueMoveOnBoard(selectedTile, direction);
  if (didMove) {
    sandboxWsEffects.sendMoveRequest(selectedTile, direction);
  }
}

export { queueMove };
