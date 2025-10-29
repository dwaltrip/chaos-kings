import { Selectable, Insertable } from 'kysely';

import { GamesTable } from '@/domains/games/game.db';
import { GameId } from '@kernel/ids';

type DBGame = Selectable<GamesTable>;
type Game = Omit<DBGame, 'id'> & { id: GameId };

type NewGame = Insertable<GamesTable>;

enum GameStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETE = 'complete',
}

export { DBGame, Game, NewGame, GameStatus };
