import type { Movement, PlayerIndex } from '@core/types';

type PlayerQueuesMap = Record<PlayerIndex, Array<Movement>>;
interface PlayerStats {
  playerIndex: PlayerIndex;
  armyCount: number;
  landCount: number;
}

export type { PlayerQueuesMap, PlayerStats };
