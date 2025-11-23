import type { Movement, PlayerIndex } from '@core/types';

type PlayerQueuesMap = Record<PlayerIndex, Array<Movement>>;

export type { PlayerQueuesMap };
