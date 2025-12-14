import { Selectable, Insertable } from 'kysely';

import { GameStatusType } from '@core/game/types';
import { GamesTable } from '@/domains/games/game.db';
import { GameId } from '@kernel/ids';

type DBGame = Selectable<GamesTable>;
type Game = Omit<DBGame, 'id' | 'status'> & { id: GameId; status: GameStatusType };

type NewGame = Insertable<GamesTable>;

export { DBGame, Game, NewGame };
