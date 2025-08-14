import { type Game } from '@common/types/games';

function roomNameForGameChat(game: Game): string {
  return `game-chat:game-${game.id}`;
}

function roomNameForGameplay(game: Game): string {
  return `gameplay-${game.id}`;
}

export { roomNameForGameChat, roomNameForGameplay };
