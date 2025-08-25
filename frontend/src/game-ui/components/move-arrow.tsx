import type { Movement } from '@core/types';

interface MoveArrowProps {
  direction: Movement;
}

const getArrowSymbol = (direction: Movement): string => {
  switch (direction) {
    case 'UP':
      return '↑';
    case 'RIGHT':
      return '→';
    case 'DOWN':
      return '↓';
    case 'LEFT':
      return '←';
    default:
      return '?';
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
      return 'move-arrow-top';
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
