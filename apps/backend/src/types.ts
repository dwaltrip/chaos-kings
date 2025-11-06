// https://kysely.dev/docs/getting-started#types

import { UsersTable } from '@/domains/users/user.db';
import { GamesTable } from '@/domains/games/game.db';
import { GamePlayersTable } from '@/domains/games/game-players.db';
import { GameChatMessagesTable } from '@/domains/chat/chat.db';

// TODO: how people using Kysely ensure this matches the actual DB schema?
// (see matching comment in chat.db.ts)
interface Database {
  users: UsersTable;
  games: GamesTable;
  game_players: GamePlayersTable;
  game_chat_messages: GameChatMessagesTable;
}

export { Database, UsersTable, GamesTable, GamePlayersTable };
