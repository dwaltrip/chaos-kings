import type { CompletedGameState } from '@core/types';
import { GameStatus, type Game } from '@core/game/types';

function isEnded(game: Game) {
  return game.status === GameStatus.COMPLETE;
}

function hasCompletedGameState(
  game: Game,
): game is Game & { game_state: CompletedGameState } {
  return (
    isEnded(game) &&
    game.game_state !== null &&
    typeof game.game_state === 'object' &&
    'board' in game.game_state
  );
}

export { isEnded, hasCompletedGameState };
