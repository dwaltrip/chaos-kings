// import { GameConfig } from '@core/game-config';

type PlayerIndex = number;

type GamePlayerStatus = 'active' | 'captured' | 'inactive';

interface Player {
  id: number;
  game_id: number;
  player_id: number;
  joined_at: Date | string | undefined;
  status: GamePlayerStatus;
  player_index: PlayerIndex;
  data: object | null;
}

// function getPlayerColorInHex(player: Player, gameConfig: GameConfig): string {
//   return ColorMap.get(player.color) || '#ddd';
// }

// export { Player, PlayerColor, getPlayerColorInHex };
export type { Player, GamePlayerStatus, PlayerIndex };
