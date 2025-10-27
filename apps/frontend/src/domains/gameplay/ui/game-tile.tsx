import React from 'react';
import clsx from 'clsx';

import type { Coord, PlayerSquare } from '@core/types';
import { areCoordsEqual } from '@core/utils/coordinate-utils';

import { useRenderCounter } from '@/lib/use-render-counter';
import { getPlayerColor } from '@/utils/player-colors';
import {
  useTileQueuedDirections,
  useTileSquare,
  useTileSquareTypes,
} from '@/domains/gameplay/hooks/use-tile-store-state';
import {
  useGameplayStoreV2,
  useIsAdjacentToSelected,
  useIsGameEnded,
  useIsTileSelected,
} from '@/domains/gameplay/stores/gameplay-store-v2';
import {
  useIsVisible,
  useNeighborVisibility,
} from '@/domains/gameplay/hooks/use-visibility';

import mountainIcon from '@/assets/mountain.svg';
import generalIcon from '@/assets/crown.png';
import { MoveArrow } from '@/domains/gameplay/ui/move-arrow';

function TileOverlay({ className, zIndex }: { className?: string; zIndex?: number }) {
  return <div className={clsx('tile-overlay', className)} style={{ zIndex }} />;
}

interface GameTileProps {
  coord: Coord;
}

const { setSelectedTileV2 } = useGameplayStoreV2.getState().actions;

const GameTile = React.memo(
  ({ coord }: GameTileProps) => {
    useRenderCounter('game-tile')();
    const row = coord.y;
    const col = coord.x;

    const isGameEnded = useGameplayStoreV2(useIsGameEnded);
    const square = useTileSquare(coord);
    const isSelected = useGameplayStoreV2(useIsTileSelected(coord));
    const selectTileV2 = () => setSelectedTileV2(coord);
    const isNeighborOfSelected = useGameplayStoreV2(useIsAdjacentToSelected(coord));

    const queuedDirections = useTileQueuedDirections(coord);
    const isVisible = useGameplayStoreV2(useIsVisible(coord));
    const neighborVisibility = useGameplayStoreV2(useNeighborVisibility(coord));

    const playerSquare = square as PlayerSquare;
    const { isMountain, isGeneral } = useTileSquareTypes(coord);

    const isSelectable = !isGameEnded && !(isMountain || isSelected);
    const isPlayer = 'playerIndex' in square;
    const isValidMove = isNeighborOfSelected && !isMountain;

    // const isOnTopEdge = coord.y === 0;
    // const isOnLeftEdge = coord.x === 0;
    const hasTopBorder = isVisible || neighborVisibility.top;
    const hasLeftBorder = isVisible || neighborVisibility.left;
    const borders = { top: hasTopBorder, left: hasLeftBorder };

    const tileClassName = clsx(
      'game-tile',
      `row-${row}`,
      `col-${col}`,
      isSelected && 'selected',
      isValidMove && 'valid-move',
      isSelectable && 'selectable',
      borders.top && 'border-top',
      borders.left && 'border-left',
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
    );

    const colorStyle =
      isPlayer && isVisible
        ? { backgroundColor: getPlayerColor(playerSquare.playerIndex) }
        : undefined;

    return (
      <div className={tileClassName} onClick={isSelectable ? selectTileV2 : undefined}>
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
          {Array.from(queuedDirections, (direction) => (
            <MoveArrow key={direction} direction={direction} />
          ))}
        </div>
      </div>
    );
  },
  // TODO: Do I need this? or is there a nicer way to do it?
  (prevProps, nextProps) => {
    // Only re-render if coordinate actually changed
    return areCoordsEqual(prevProps.coord, nextProps.coord);
  },
);

GameTile.displayName = 'GameTile';

export { GameTile };
