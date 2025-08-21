import clsx from 'clsx';
import mountainIcon from '@/assets/mountain.svg';
import generalIcon from '@/assets/crown.png';
import { SquareType, type Square, type PlayerSquare } from '@core/types';
import { playerIndexToColor } from '@/game-ui/config/ui-constants';
import type { TileVisibilityData } from '@/game-ui/hooks/use-tile-neighbor-visibility';
import { isMountainSquare } from '@core/square';

interface TileContentProps {
  square: Square;
  isSelected: boolean;
  isVisible: boolean;
  isGeneral: boolean;
  onClick: () => void;
  neighborVisibility: TileVisibilityData;
  isOnEdge: {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  };
}

function TileContent({
  square,
  isSelected,
  isVisible,
  isGeneral,
  onClick,
  neighborVisibility,
  isOnEdge,
}: TileContentProps) {
  const isPlayer = 'playerIndex' in square;
  const playerSquare = square as PlayerSquare;
  const isMountain = isMountainSquare(square);

  // Show borders only between tiles that are BOTH visible
  // Each tile only draws TOP and LEFT borders to avoid double-thickness
  const borders = {
    top: isVisible && neighborVisibility.top && !isOnEdge.top,
    right: false, // Never draw - right neighbor handles this
    bottom: false, // Never draw - bottom neighbor handles this
    left: isVisible && neighborVisibility.left && !isOnEdge.left,
  };

  const className = clsx(
    'cell',
    square.type.toString().toLowerCase(),
    isPlayer && 'player-square',
    isGeneral ? 'general-icon' : isPlayer && 'army-square',
    isVisible ? 'visible' : 'fog-of-war',
    isSelected && 'selected',
    isMountain && 'mountain',
    borders.top && 'border-top',
    borders.right && 'border-right',
    borders.bottom && 'border-bottom',
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
