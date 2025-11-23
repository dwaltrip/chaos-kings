import type { Direction, Coord, PlayerIndex } from '@core/types';

const GAMEPLAY_DOMAIN = 'gameplay';

interface Movement {
  sourceCoord: Coord;
  direction: Direction;
}
type PlayerQueuesMap = Record<PlayerIndex, Array<Movement>>;

export { GAMEPLAY_DOMAIN, type Movement, type PlayerQueuesMap };
