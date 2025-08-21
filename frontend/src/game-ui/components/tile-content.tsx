import clsx from 'clsx';
import mountainIcon from '@/assets/mountain.svg';
import generalIcon from '@/assets/crown.png';
import { type Square, type PlayerSquare } from '@core/types';
import { playerIndexToColor } from '@/game-ui/config/ui-constants';
import type {
  NeighborVisibility,
  BorderData,
} from '@/game-ui/utils/tile-utils';
import { isMountainSquare } from '@core/square';

interface TileContentProps {
  square: Square;
  isSelected: boolean;
  isNeighborOfSelected: boolean;
  isVisible: boolean;
  isGeneral: boolean;
  onClick: () => void;
  neighborVisibility: NeighborVisibility;
  borders: BorderData;
}

function TileContent({
  square,
  isSelected,
  isNeighborOfSelected,
  isVisible,
  isGeneral,
  onClick,
  borders,
}: TileContentProps) {
  const isPlayer = 'playerIndex' in square;
  const playerSquare = square as PlayerSquare;
  const isMountain = isMountainSquare(square);

  const className = clsx(
    'cell',
    square.type.toString().toLowerCase(),
    isPlayer && 'player-square',
    isGeneral ? 'general-icon' : isPlayer && 'army-square',
    isVisible ? 'visible' : 'fog-of-war',
    isSelected && 'selected',
    isNeighborOfSelected && 'neighbor-highlighted',
    isMountain && 'mountain',
    borders.top && 'border-top',
    borders.left && 'border-left',
  );

  const colorStyle =
    isPlayer && isVisible
      ? {
          backgroundColor: playerIndexToColor(playerSquare.playerIndex),
        }
      : undefined;

  return (
    <div className={className} style={colorStyle} onClick={onClick}>
      {isMountain && <img src={mountainIcon} />}

      {isPlayer && isVisible && (
        <>
          {isGeneral && <img className="general-img" src={generalIcon} />}
          <div className="army-count">{playerSquare.units}</div>
        </>
      )}
    </div>
  );
}

export { TileContent };
