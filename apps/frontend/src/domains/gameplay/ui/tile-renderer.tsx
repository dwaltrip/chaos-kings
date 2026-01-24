import React from 'react';
import clsx from 'clsx';

import type { Coord, Direction, PlayerSquare, Square } from '@core/types';

import { getPlayerColor } from '@/utils/player-colors';

import mountainIcon from '@/assets/mountain.svg';
import generalIcon from '@/assets/crown.png';
import { MoveArrow } from '@/domains/gameplay/ui/move-arrow';

function TileOverlay({ className, zIndex }: { className?: string; zIndex?: number }) {
  return <div className={clsx('tile-overlay', className)} style={{ zIndex }} />;
}

interface TileRendererProps {
  coord: Coord;
  square: Square;

  // Visibility state
  isVisible: boolean;
  hasTopBorder: boolean;
  hasLeftBorder: boolean;

  // Interaction state (optional, for gameplay)
  isSelected?: boolean;
  isSelectable?: boolean;
  isValidMove?: boolean;
  queuedDirections?: Set<Direction>;
  onClick?: () => void;
}

const TileRenderer = React.memo(
  ({
    coord,
    square,
    isVisible,
    hasTopBorder,
    hasLeftBorder,
    isSelected = false,
    isSelectable = false,
    isValidMove = false,
    queuedDirections,
    onClick,
  }: TileRendererProps) => {
    const row = coord.y;
    const col = coord.x;

    const isMountain = square.type === 'MOUNTAIN';
    const isGeneral = square.type === 'GENERAL';
    const isPlayer = 'playerIndex' in square;
    const playerSquare = square as PlayerSquare;

    const tileClassName = clsx(
      'game-tile',
      `row-${row}`,
      `col-${col}`,
      isSelected && 'selected',
      isValidMove && 'valid-move',
      isSelectable && 'selectable',
      hasTopBorder && 'border-top',
      hasLeftBorder && 'border-left',
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
      <div className={tileClassName} onClick={onClick}>
        <div className={contentClassName} style={colorStyle}>
          {isMountain && <img className="mountain-img" src={mountainIcon} />}

          {isPlayer && isVisible && (
            <>
              {isGeneral && <img className="general-img" src={generalIcon} />}
              <div className="army-count">{playerSquare.units}</div>
            </>
          )}

          {(isValidMove || !isVisible) && <TileOverlay className="possible-move" />}
          {!isVisible && <TileOverlay className="fog-of-war" />}

          {queuedDirections &&
            Array.from(queuedDirections, (direction) => (
              <MoveArrow key={direction} direction={direction} />
            ))}
        </div>
      </div>
    );
  },
);

TileRenderer.displayName = 'TileRenderer';

export type { TileRendererProps };
export { TileRenderer };
