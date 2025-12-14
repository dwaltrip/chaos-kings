import type { CompletedGameState } from '@core/types';
import { GameStatus, type AbstractGame } from '@core/game/types';

function isEnded(game: AbstractGame) {
  return game.status === GameStatus.COMPLETE;
}

function hasCompletedGameState(
  game: AbstractGame,
): game is AbstractGame & { game_state: CompletedGameState } {
  return (
    isEnded(game) &&
    game.game_state !== null &&
    typeof game.game_state === 'object' &&
    'board' in game.game_state
  );
}

export { isEnded, hasCompletedGameState };
