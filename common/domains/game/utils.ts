import { type Game } from '@common/types/games';

function roomNameForGameChat(game: Game): string {
  return `game-chat:game-${game.id}`;
}

function roomNameForGameplay(gameOrGameId: Game | string): string {
  return `gameplay-${typeof gameOrGameId === 'string' ? gameOrGameId : gameOrGameId.id}`;
}

export { roomNameForGameChat, roomNameForGameplay };
