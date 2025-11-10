import type { Direction, Coord } from '@core/types';

const GAMEPLAY_DOMAIN = 'gameplay';

type PlayerIndex = number;
interface Movement {
  sourceCoord: Coord;
  direction: Direction;
}
type PlayerQueuesMap = Record<PlayerIndex, Array<Movement>>;

export { GAMEPLAY_DOMAIN, type Movement, type PlayerQueuesMap, type PlayerIndex };
