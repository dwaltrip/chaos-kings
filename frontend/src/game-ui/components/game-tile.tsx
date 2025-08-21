import clsx from 'clsx';
import mountainIcon from '@/assets/mountain.svg';
import generalIcon from '@/assets/crown.png';
import type { Coord, PlayerSquare } from '@core/types';
import { playerIndexToColor } from '@/game-ui/config/ui-constants';
import { isMountainSquare } from '@core/square';
import { useTileState } from '@/game-ui/hooks/use-tile-state';
import { useGameplay } from '@/game-ui/hooks/use-gameplay';

function TileOverlay({
  className,
  zIndex,
}: {
  className?: string;
  zIndex?: number;
}) {
  return <div className={clsx('tile-overlay', className)} style={{ zIndex }} />;
}

interface GameTileProps {
  coord: Coord;
  row: number;
  col: number;
}

function GameTile({ coord, row, col }: GameTileProps) {
  const tileState = useTileState(coord);
  const { handleTileSelect } = useGameplay();

  const {
    square,
    isSelected,
    isSelectable,
    isNeighborOfSelected,
    isVisible,
    isGeneral,
    borders,
  } = tileState;

  const handleTileClick = () => handleTileSelect(coord);

  const isPlayer = 'playerIndex' in square;
  const playerSquare = square as PlayerSquare;
  const isMountain = isMountainSquare(square);
  const isValidMove = !isMountain;

  // Create custom border CSS variable based on tile state
  let customBorder = 'none';
  if (isSelected) {
    customBorder = '2px solid #ffdd00';
  } else if (isNeighborOfSelected) {
    customBorder = '1px solid #88ff88';
  }

  const tileClassName = clsx(
    'game-tile',
    `row-${row}`,
    `col-${col}`,
    (isSelected || isNeighborOfSelected) && 'custom-border',
  );

  const contentClassName = clsx(
    'cell',
    square.type.toString().toLowerCase(),
    isPlayer && 'player-square',
    isGeneral ? 'general-icon' : isPlayer && 'army-square',
    isVisible ? 'visible' : 'fog-of-war',
    isSelectable && 'selectable',
    isSelected && 'selected',
    isNeighborOfSelected && 'is-neighbor-selected',
    isMountain && 'mountain',
    borders.top && 'border-top',
    borders.left && 'border-left',
  );

  const tileStyle: React.CSSProperties = {
    cursor: isSelectable ? 'pointer' : 'default',
    '--game-tile-custom-border': customBorder,
  } as React.CSSProperties;

  const colorStyle =
    isPlayer && isVisible
      ? {
          backgroundColor: playerIndexToColor(playerSquare.playerIndex),
        }
      : undefined;

  return (
    <div
      className={tileClassName}
      style={tileStyle}
      onClick={isSelectable ? handleTileClick : undefined}
    >
      <div className={contentClassName} style={colorStyle}>
        {isMountain && <img className="mountain-img" src={mountainIcon} />}

        {isPlayer && isVisible && (
          <>
            {isGeneral && <img className="general-img" src={generalIcon} />}
            <div className="army-count">{playerSquare.units}</div>
          </>
        )}

        {isNeighborOfSelected && isValidMove && (
          <TileOverlay className="possible-move" />
        )}
        {!isVisible && <TileOverlay className="fog-of-war" />}
      </div>
    </div>
  );
}

export { GameTile };
