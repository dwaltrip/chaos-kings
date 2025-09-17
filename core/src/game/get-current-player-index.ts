import type { GameWithPlayers } from '@common/types/games';

function getCurrentPlayerIndex(
  game: GameWithPlayers,
  userId: number,
): number | null {
  const player = game.players.find((p) => p.player_id === userId);
  return player ? player.player_index : null;
}

export { getCurrentPlayerIndex };
