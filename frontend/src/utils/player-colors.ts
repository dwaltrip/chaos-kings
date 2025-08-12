import { PLAYER_COLORS, ColorMap } from '@core/colors';
import type { Player } from '@common/types/player';

function getPlayerColor(playerIndex: number): string {
  const colorName = PLAYER_COLORS[playerIndex];
  if (!colorName) {
    return '#777777'; // Default gray for invalid indices
  }
  return ColorMap.get(colorName) || '#777777';
}

function getPlayerColorHex(player: Player): string {
  return getPlayerColor(player.player_index);
}

interface PlayerDisplayInfo {
  id: number;
  playerId: number;
  playerIndex: number;
  username?: string;
  color: string;
  status: string;
}

function getPlayerDisplayInfo(player: Player & { username?: string }): PlayerDisplayInfo {
  return {
    id: player.id,
    playerId: player.player_id,
    playerIndex: player.player_index,
    username: player.username,
    color: getPlayerColor(player.player_index),
    status: player.status,
  };
}

export { getPlayerColor, getPlayerColorHex, getPlayerDisplayInfo };
export type { PlayerDisplayInfo };