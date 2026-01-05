// export { onPlayerJoined } from './on-player-joined';
// export { onPlayerLeft } from './on-player-left';
// export { queueMove } from './move-action';
// export { cancelQueuedMoves } from './cancel-moves-action';
// export { undoLastQueuedMove } from './undo-move-request';
// export { addUserToGame, removeUserFromGame, getUserGame } from './user-game-mapping';
// export { registerPlayersForGame } from './register-players-for-game';

import { makeGeneralSquare } from '@core/map/make-squares';
import { makeBlankMap } from '@core/map/make-blank-map';
import { User } from '@platform/domains/users/types-deprecated';

/*
  - startPlaying
  - queueMove
  - undoMove
  - cancelMoves

  - finishPuzzle
  - 
*/

function startPlaying(user: any) {
  // generate map
  const grid = makeBlankMap(21, 21);
  grid[11][11] = makeGeneralSquare({ x: 11, y: 11 }, 0);

  // start puzzle timer
  // send board to user
}
