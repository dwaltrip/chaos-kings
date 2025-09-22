import { type Game } from '@common/types/games';
import { roomKey } from '@common/utils/room-key';
import { GAME_CHAT_DOMAIN } from '@common/types/game-chat';

// Returns a bare chat room id for a game (without domain prefix)
function bareRoomForGameChat(game: Game): string {
  return `game-${game.id}`;
}

// Full composite room key for chat domain
function roomNameForGameChat(game: Game): string {
  return roomKey(GAME_CHAT_DOMAIN, bareRoomForGameChat(game));
}

function roomNameForGameplay(gameOrGameId: Game | string): string {
  return `gameplay-${typeof gameOrGameId === 'string' ? gameOrGameId : gameOrGameId.id}`;
}

export { bareRoomForGameChat, roomNameForGameChat, roomNameForGameplay };
