import type { GameWithPlayers } from '@platform/domains/games/types';

function getCurrentPlayerIndex(game: GameWithPlayers, userId: number): number | null {
  const player = game.players.find((p) => p.user_id === userId);
  return player ? player.player_index : null;
}

export { getCurrentPlayerIndex };
