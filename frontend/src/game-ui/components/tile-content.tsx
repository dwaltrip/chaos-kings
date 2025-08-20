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
}

function TileContent({
  square,
  isSelected,
  isVisible,
  isGeneral,
  onClick,
  neighborVisibility,
}: TileContentProps) {
  const isPlayer = 'playerIndex' in square;
  const playerSquare = square as PlayerSquare;
  const showMountain = shouldShowMountain(square);

  // Show borders only between tiles that are BOTH visible
  const borders = {
    top: isVisible && neighborVisibility.top,
    right: isVisible && neighborVisibility.right,
    bottom: isVisible && neighborVisibility.bottom,
    left: isVisible && neighborVisibility.left,
  };

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
          <div className="army-count">{playerSquare.units}</div>
        </>
      )}
    </div>
  );
}

export { TileContent };
