import clsx from 'clsx';
import mountainIcon from '@/assets/mountain.svg';
import generalIcon from '@/assets/crown.png';
import { SquareType, type Square, type PlayerSquare } from '@core/types';
import { shouldShowMountain } from '@/game-ui/utils/visibility-utils';
import { playerIndexToColor } from '@/game-ui/config/ui-constants';
import type { TileVisibilityData } from '@/game-ui/hooks/use-tile-neighbor-visibility';

interface TileContentProps {
  square: Square;
  isSelected: boolean;
  isVisible: boolean;
  isGeneral: boolean;
  onClick: () => void;
  neighborVisibility: TileVisibilityData;
  isOnEdge: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
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
  const showMountain = shouldShowMountain(square);

  // figure out borders based on neighbor visibility
  const borders = {
    top: false,
    right: false,
    bottom: false,
    left: false,
  };
  if (isVisible) {
    if (isOnEdge.top) {
      borders.top = true;
    }
    if (isOnEdge.left) {
      borders.left = true;
    }
    if (isOnEdge.bottom) {
      borders.bottom = true;
    }
    if (isOnEdge.bottom || neighborVisibility.bottom) {
      borders.bottom = true;
    }
    if (isOnEdge.right || neighborVisibility.right) {
      borders.right = true;
    }
  }

  const className = clsx(
    'cell',
    square.type.toString().toLowerCase(),
    isPlayer && 'player-square',
    isGeneral ? 'general-icon' : isPlayer && 'army-square',
    !isVisible && 'fog-of-war',
    isSelected && 'selected',
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
      {(isVisible || showMountain) && square.type === SquareType.MOUNTAIN && (
        <img src={mountainIcon} />
      )}

      {isPlayer && isVisible && (
        <>
          {isGeneral && <img className="general-img" src={generalIcon} />}
          <span className="army-count">{playerSquare.units}</span>
        </>
      )}
    </div>
  );
}

export { TileContent };
