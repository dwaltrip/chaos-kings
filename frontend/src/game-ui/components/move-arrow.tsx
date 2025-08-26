import type { Movement } from '@core/types';

interface MoveArrowProps {
  direction: Movement;
}

const THIN_ARROWS = {
  RIGHT: '⭢',
  DOWN: '⭣',
  LEFT: '⭠',
  UP: '⭡',
};

// Just for convenience, for later UI tweaking
// @ts-ignore
const _ARROWS = {
  RIGHT: '→',
  DOWN: '↓',
  LEFT: '←',
  UP: '↑',
};

const getArrowSymbol = (direction: Movement): string => {
  switch (direction) {
    case 'UP':
      return THIN_ARROWS.UP;
    case 'RIGHT':
      return THIN_ARROWS.RIGHT;
    case 'DOWN':
      return THIN_ARROWS.DOWN;
    case 'LEFT':
      return THIN_ARROWS.LEFT;
    default:
      throw new Error(`Invalid direction: ${direction}`);
  }
};

const getArrowClass = (direction: Movement): string => {
  switch (direction) {
    case 'UP':
      return 'move-arrow-top';
    case 'RIGHT':
      return 'move-arrow-right';
    case 'DOWN':
      return 'move-arrow-bottom';
    case 'LEFT':
      return 'move-arrow-left';
    default:
      throw new Error(`Invalid direction: ${direction}`);
  }
};

const MoveArrow = ({ direction }: MoveArrowProps) => {
  return (
    <div className={`move-arrow ${getArrowClass(direction)}`}>
      {getArrowSymbol(direction)}
    </div>
  );
};

export { MoveArrow };
