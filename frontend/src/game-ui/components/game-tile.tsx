import React from 'react';
import clsx from 'clsx';
import mountainIcon from '@/assets/mountain.svg';
import generalIcon from '@/assets/crown.png';
import type { Coord, PlayerSquare } from '@core/types';
import { playerIndexToColor } from '@/game-ui/config/ui-constants';
import { isMountainSquare } from '@core/square';
import { useTileState } from '@/game-ui/hooks/use-tile-state';
import { useGameplay } from '@/game-ui/hooks/use-gameplay';
import { useTileQueuedMoves } from '@/game-ui/hooks/use-tile-queued-moves';
import { MoveArrow } from '@/game-ui/components/move-arrow';

// Track render count
let renderCount = 0;
let lastLogTime = Date.now();

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

const GameTile = React.memo(
  ({ coord, row, col }: GameTileProps) => {
    // Track renders
    renderCount++;
    const now = Date.now();
    if (now - lastLogTime > 100) {
      // Log every 100ms to batch renders
      console.log(
        `[PERF] ${renderCount} tile renders in last ${now - lastLogTime}ms`,
      );
      renderCount = 0;
      lastLogTime = now;
    }

    const tileState = useTileState(coord);
    const { handleTileSelect } = useGameplay();
    const tileQueuedMoves = useTileQueuedMoves(coord);

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

    // Get unique directions (in case there are multiple moves in same direction)
    const uniqueDirections = Array.from(new Set(tileQueuedMoves));

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
  },
  (prevProps, nextProps) => {
    // Only re-render if coordinate actually changed
    return (
      prevProps.coord.x === nextProps.coord.x &&
      prevProps.coord.y === nextProps.coord.y &&
      prevProps.row === nextProps.row &&
      prevProps.col === nextProps.col
    );
  },
);

GameTile.displayName = 'GameTile';

export { GameTile };
