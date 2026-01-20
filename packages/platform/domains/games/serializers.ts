import { GameId, UserId } from '@kernel/ids';
import { idToNumber } from '@kernel/branded-type';

import type {
  Game,
  GameDTO,
  GameWithPlayers,
  GameWithPlayersDTO,
  Player,
  PlayerDTO,
} from './types';

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

function serializePlayer(player: Player): PlayerDTO {
  return {
    ...player,
    game_id: idToNumber(player.game_id),
    user_id: idToNumber(player.user_id),
    joined_at:
      player.joined_at instanceof Date
        ? player.joined_at.toISOString()
        : player.joined_at,
  };
}

function deserializePlayer(dto: PlayerDTO): Player {
  return {
    ...dto,
    game_id: GameId(dto.game_id),
    user_id: UserId(dto.user_id),
  };
}

function serializeGameWithPlayers(game: GameWithPlayers): GameWithPlayersDTO {
  return {
    ...serializeGame(game),
    players: game.players.map(serializePlayer),
  };
}

function deserializeGameWithPlayers(dto: GameWithPlayersDTO): GameWithPlayers {
  return {
    ...deserializeGame(dto),
    players: dto.players.map(deserializePlayer),
  };
}

export {
  serializeGame,
  deserializeGame,
  serializePlayer,
  deserializePlayer,
  serializeGameWithPlayers,
  deserializeGameWithPlayers,
};
