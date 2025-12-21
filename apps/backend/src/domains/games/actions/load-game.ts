import { invariant } from '@utils/assertions/invariant';
import { GameId } from '@kernel/ids';
import type { GameWithPlayers, Player } from '@platform/domains/games/types';

import { gameRepository } from '@/domains/games/game-repository';

class GameNotFoundError extends Error {
  constructor(gameId: GameId) {
    super(`Game not found: ${gameId}`);
  }
}

// TODO: This overlaps with getGame action...
// * Happened during some vibe-engineered refactoring.
// * Figure out later resolve this.
async function loadGame(gameId: GameId): Promise<GameWithPlayers> {
  const game = await gameRepository.findByIdWithPlayers(gameId);
  if (!game) throw new GameNotFoundError(gameId);

  validatePlayerIndices(game.players);
  return game;
}

function validatePlayerIndices(players: Player[]): void {
  const indices = players.map((p) => p.player_index).sort((a, b) => a - b);
  const expected = players.map((_, i) => i);

  invariant(
    indices.every((idx, i) => idx === expected[i]),
    `Player indices must be contiguous starting from 0. Got: [${indices.join(', ')}]`,
  );
}

export { loadGame, GameNotFoundError };
