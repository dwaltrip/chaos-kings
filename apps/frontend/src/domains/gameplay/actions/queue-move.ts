import type { Coord, Direction } from '@core/types';

import { queueMoveOnBoard } from '@/domains/games/board/actions';
import { gameplayWsEffects } from '@/domains/gameplay/ws-effects';

function queueMove(direction: Direction, selectedTile: Coord | null): void {
  const didMove = selectedTile && queueMoveOnBoard(selectedTile, direction);
  if (didMove) {
    gameplayWsEffects.sendMoveRequest(selectedTile, direction);
  }
}

export { queueMove };
