import { type Game } from '@common/types/games';

function roomNameForGameChat(game: Game): string {
  return `game-chat:game-${game.id}`;
} 

export { roomNameForGameChat };

