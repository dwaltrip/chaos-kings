import React from 'react';
import clsx from 'clsx';
import mountainIcon from '@/assets/mountain.svg';
import generalIcon from '@/assets/crown.png';
import type { Coord, PlayerSquare } from '@core/types';
import { playerIndexToColor } from '@/game-ui/config/ui-constants';
// import { useTileState } from '@/game-ui/hooks/use-tile-state';
// import { useGameplay } from '@/game-ui/hooks/use-gameplay';
import {
  useTileQueuedMovesV2,
  useTileSquare,
  useTileSquareTypes,
} from '@/game-ui/hooks/use-tile-store-state';
import { MoveArrow } from '@/game-ui/components/move-arrow';
import {
  useGameplayStoreV2,
  useIsTileSelected,
} from '@/game-ui/store/gameplay-store-v2';

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

const { setSelectedTileV2 } = useGameplayStoreV2.getState().actions;

const GameTile = React.memo(
  ({ coord, row, col }: GameTileProps) => {
    // Track renders
    renderCount++;
    const now = Date.now();
    if (now - lastLogTime > 1000) {
      // Log every 1000ms to batch renders
      console.log(
        `[PERF] ${renderCount} tile renders in last ${now - lastLogTime}ms`,
      );
      renderCount = 0;
      lastLogTime = now;
    }

    // ---- my new stuff for the refactotr
    // Adding square to store...
    const square = useTileSquare(coord);

    // gameplay store v2
    const isSelected = useGameplayStoreV2(useIsTileSelected(coord));
    const selectTileV2 = () => setSelectedTileV2(coord);
    // ---- my new stuff for the refactotr

    // Phase 1: Individual subscriptions (no object recreation)
    const queuedMoves = useTileQueuedMovesV2(coord);

    // Keep existing hook for complex state (Phase 2 will migrate)
    // Use tile store values where available, fall back to old hook
    // const { square, isSelectable, isNeighborOfSelected, isVisible, borders } =
    //   tileState;

    const playerSquare = square as PlayerSquare;
    const { isMountain, isGeneral } = useTileSquareTypes(coord);

    // ------------------------------------------------
    // ------------------------------------------------
    // TODO: temp, until implemented in TileStore
    const isVisible = true;
    const isSelectable = !isMountain;
    const isNeighborOfSelected = false;
    const borders = { top: false, bottom: false, left: false, right: false };
    // ------------------------------------------------
    // ------------------------------------------------

    const isPlayer = 'playerIndex' in square;
    const isValidMove = isNeighborOfSelected && !isMountain;

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
      // TODO: not sure if this is implemented correctly
      // might have gotten messed up in refactor
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
        onClick={isSelectable ? selectTileV2 : undefined}
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
          {Array.from(queuedMoves, (direction) => (
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
