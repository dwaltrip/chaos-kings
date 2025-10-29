import { Selectable, Insertable } from 'kysely';

import { GamesTable } from '@/domains/games/game.db';

type Game = Selectable<GamesTable>;
type NewGame = Insertable<GamesTable>;

enum GameStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETE = 'complete',
}

export { Game, NewGame, GameStatus };
