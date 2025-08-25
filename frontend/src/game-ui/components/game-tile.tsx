import clsx from 'clsx';
import mountainIcon from '@/assets/mountain.svg';
import generalIcon from '@/assets/crown.png';
import type { Coord, PlayerSquare } from '@core/types';
import { playerIndexToColor } from '@/game-ui/config/ui-constants';
import { isMountainSquare } from '@core/square';
import { useTileState } from '@/game-ui/hooks/use-tile-state';
import { useGameplay } from '@/game-ui/hooks/use-gameplay';
import { gameplayStore } from '@/game-ui/store/gameplay-store';
import { MoveArrow } from '@/game-ui/components/move-arrow';

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
  const queuedMoves = gameplayStore((state) => state.queuedMoves);

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
  const isValidMove = isNeighborOfSelected && !isMountain;

  // Get queued moves for this tile
  const tileQueuedMoves = queuedMoves.filter(
    (move) => move.sourceCoord.x === coord.x && move.sourceCoord.y === coord.y,
  );

  // Get unique directions (in case there are multiple moves in same direction)
  const uniqueDirections = Array.from(
    new Set(tileQueuedMoves.map((move) => move.direction)),
  );

  const tileClassName = clsx(
    'game-tile',
    `row-${row}`,
    `col-${col}`,
    isSelected && 'selected',
    isValidMove && 'valid-move',
    isSelectable && 'selectable',
  );

  const contentClassName = clsx(
    'cell',
    square.type.toString().toLowerCase(),
    isPlayer && 'player-square',
    isGeneral ? 'general-icon' : isPlayer && 'army-square',
    isVisible ? 'visible' : 'fog-of-war',
    isSelectable && 'selectable',
    isSelected && 'selected',
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
    <div
      className={tileClassName}
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

        {/* Render move arrows for queued moves */}
        {uniqueDirections.map((direction) => (
          <MoveArrow key={direction} direction={direction} />
        ))}
      </div>
    </div>
  );
}

export { GameTile };
