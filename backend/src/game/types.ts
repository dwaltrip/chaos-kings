import { GamesTable } from '@/game/game.db';
import { Selectable, Insertable } from 'kysely';

type Game = Selectable<GamesTable>;
type NewGame = Insertable<GamesTable>;

enum GameStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETE = 'complete'
}

export {
  Game,
  NewGame,
  GameStatus,
};

