import { GameId } from '@kernel/ids';
import { type CoreGameAttrs } from '@core/game/types';
import type { PlayerIndex } from '@core/types';

type GamePlayerStatus = 'active' | 'captured' | 'inactive';

interface Player {
  id: number;
  game_id: number;
  user_id: number;
  joined_at: Date | string | undefined;
  status: GamePlayerStatus;
  player_index: PlayerIndex;
  data: object | null;
  username: string;
}

// Domain types - used in application code with branded IDs and Date objects
interface Game extends CoreGameAttrs {
  id: GameId;
  created_at: Date;
  updated_at: Date;
}

interface GameWithPlayers extends Game {
  players: Player[];
}

// Wire types - for JSON serialization over HTTP/WebSocket
// TODO: Tentative pattern - not sure if DTO types should live here long-term
// Overall still thinking about different types for different layers of the app
interface GameDTO extends CoreGameAttrs {
  id: number;
  created_at: string;
  updated_at: string;
}

interface GameWithPlayersDTO extends GameDTO {
  players: Player[];
}

export type {
  Game,
  GameWithPlayers,
  GameDTO,
  GameWithPlayersDTO,
  Player,
  GamePlayerStatus,
};
