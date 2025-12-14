import { GameId } from '@kernel/ids';
import { idToNumber } from '@kernel/branded-type';

import type { Game, GameDTO, GameWithPlayers, GameWithPlayersDTO } from './types';

function serializeGame(game: Game): GameDTO {
  return {
    ...game,
    id: idToNumber(game.id),
    created_at: game.created_at.toISOString(),
    updated_at: game.updated_at.toISOString(),
  };
}

function deserializeGame(dto: GameDTO): Game {
  return {
    ...dto,
    id: GameId(dto.id),
    created_at: new Date(dto.created_at),
    updated_at: new Date(dto.updated_at),
  };
}

function serializeGameWithPlayers(game: GameWithPlayers): GameWithPlayersDTO {
  return {
    ...serializeGame(game),
    players: game.players,
  };
}

function deserializeGameWithPlayers(dto: GameWithPlayersDTO): GameWithPlayers {
  return {
    ...deserializeGame(dto),
    players: dto.players,
  };
}

export {
  serializeGame,
  deserializeGame,
  serializeGameWithPlayers,
  deserializeGameWithPlayers,
};
