import { GameStatus, type Game } from '@common/types/games';

function isEnded(game: Game) {
  return game.status === GameStatus.COMPLETE;
}

export { isEnded };
