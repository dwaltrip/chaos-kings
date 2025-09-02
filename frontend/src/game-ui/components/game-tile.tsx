import React from 'react';
import clsx from 'clsx';

import type { Coord, PlayerSquare } from '@core/types';
import { playerIndexToColor } from '@/game-ui/config/ui-constants';
import {
  useTileQueuedMovesV2,
  useTileSquare,
  useTileSquareTypes,
} from '@/game-ui/hooks/use-tile-store-state';
import {
  useGameplayStoreV2,
  useIsAdjacentToSelected,
  useIsTileSelected,
} from '@/game-ui/store/gameplay-store-v2';
import {
  useIsVisible,
  useNeighborVisibility,
} from '@/game-ui/hooks/use-visibility';

import { MoveArrow } from '@/game-ui/components/move-arrow';
import mountainIcon from '@/assets/mountain.svg';
import generalIcon from '@/assets/crown.png';

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
    const square = useTileSquare(coord);
    const isSelected = useGameplayStoreV2(useIsTileSelected(coord));
    const selectTileV2 = () => setSelectedTileV2(coord);
    const isNeighborOfSelected = useGameplayStoreV2(
      useIsAdjacentToSelected(coord),
    );

    const queuedMoves = useTileQueuedMovesV2(coord);

    const isVisible = useGameplayStoreV2(useIsVisible(coord));
    const neighborVisibility = useGameplayStoreV2(useNeighborVisibility(coord));

    const playerSquare = square as PlayerSquare;
    const { isMountain, isGeneral } = useTileSquareTypes(coord);

    const isGameEnded = useGameplayStoreV2((state) => state.isGameEnded);
    const isSelectable = !isGameEnded && !(isMountain || isSelected);
    const isPlayer = 'playerIndex' in square;
    const isValidMove = isNeighborOfSelected && !isMountain;

    const isOnTopEdge = coord.y === 0;
    const isOnLeftEdge = coord.x === 0;
    const borders = !isVisible
      ? { top: false, left: false }
      : {
          top: neighborVisibility.top && !isOnTopEdge,
          left: neighborVisibility.left && !isOnLeftEdge,
        };

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
  // TODO: Do I need this? or is there a nicer way to do it?
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
