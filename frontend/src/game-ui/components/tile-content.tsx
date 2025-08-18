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
  neighborVisibility?: TileVisibilityData;
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

  const className = clsx(
    'cell',
    square.type.toString().toLowerCase(),
    isPlayer && 'player-square',
    isGeneral ? 'general-icon' : isPlayer && 'army-square',
    !isVisible && 'fog-of-war',
    isSelected && 'selected',
    neighborVisibility && {
      'tile-exploration-high': neighborVisibility.explorationValue === 'high',
      'tile-exploration-medium':
        neighborVisibility.explorationValue === 'medium',
      'tile-exploration-low': neighborVisibility.explorationValue === 'low',
      'tile-visibility-edge': neighborVisibility.isOnVisibilityEdge,
    },
  );

  const colorStyle =
    isPlayer && isVisible
      ? {
          backgroundColor: playerIndexToColor(playerSquare.playerIndex),
        }
      : undefined;

  const tooltipTitle = neighborVisibility
    ? `Exploration: ${neighborVisibility.explorationValue} (${neighborVisibility.hiddenNeighborCount} hidden neighbors)`
    : undefined;

  return (
    <div
      className={className}
      style={colorStyle}
      onClick={onClick}
      title={tooltipTitle}
    >
      {/* Mountain rendering */}
      {(isVisible || showMountain) && square.type === SquareType.MOUNTAIN && (
        <img src={mountainIcon} />
      )}

      {/* Player content rendering */}
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
