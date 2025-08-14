import clsx from 'clsx';
import mountainIcon from '@/assets/mountain.svg';
import { SquareType, type Square, type Coord } from '@core/types';
import { debugTileClick } from '@/game-ui/utils/debug-utils';

interface SquareViewProps {
  square: Square;
  coord: Coord;
  isSelected: boolean;
  onTileSelect: (coord: Coord) => void;
  isVisible: boolean;
  showMountain: boolean;
}

function SquareView({
  square,
  coord,
  isSelected,
  onTileSelect,
  isVisible,
  showMountain,
}: SquareViewProps) {
  const className = clsx(
    'cell',
    square && square.type.toString().toLowerCase(),
    isSelected && 'selected',
    !isVisible && 'fog-of-war',
  );

  const handleClick = () => {
    debugTileClick(coord);
    onTileSelect(coord);
  };

  if (!square) {
    throw new Error('Square is null');
  }

  return (
    <div className={className} onClick={handleClick}>
      {(isVisible || showMountain) && square.type === SquareType.MOUNTAIN && (
        <img src={mountainIcon} />
      )}
    </div>
  );
}

export { SquareView };
