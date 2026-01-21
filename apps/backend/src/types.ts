// https://kysely.dev/docs/getting-started#types

import { UsersTable } from '@/domains/users/user.db';
import { GamesTable } from '@/domains/games/game.db';
import { GamePlayersTable } from '@/domains/games/game-players.db';
import { GameChatMessagesTable } from '@/domains/chat/chat.db';
import { PuzzleAttemptsTable } from '@/domains/puzzles/puzzle-attempt.db';

// TODO: how people using Kysely ensure this matches the actual DB schema?
// (see matching comment in chat.db.ts)
interface Database {
  users: UsersTable;
  games: GamesTable;
  game_players: GamePlayersTable;
  game_chat_messages: GameChatMessagesTable;
  puzzle_attempts: PuzzleAttemptsTable;
}

export type { PuzzleAttemptsTable };
export { Database, UsersTable, GamesTable, GamePlayersTable };
