import clsx from 'clsx';
import { type ReactNode } from 'react';
import { type PlayerSquare, type Coord } from '@core/types';
import { playerIndexToColor } from '@/game-ui/config/ui-constants';
import { debugPlayerSquareClick } from '@/game-ui/utils/debug-utils';

interface PlayerSquareLayoutProps {
  playerIndex: number;
  children: ReactNode;
  className?: string;
  isSelected: boolean;
  onClick: () => void;
  isVisible: boolean;
}

function PlayerSquareLayout({
  playerIndex,
  children,
  className,
  isSelected,
  onClick,
  isVisible,
}: PlayerSquareLayoutProps) {
  const colorStyle = { backgroundColor: playerIndexToColor(playerIndex) };

  const handleClick = () => {
    debugPlayerSquareClick(isSelected);
    onClick();
  };

  return (
    <div
      className={clsx(
        'player-square',
        className,
        isSelected && 'selected',
        !isVisible && 'fog-of-war',
      )}
      style={colorStyle}
      onClick={handleClick}
    >
      {children}
    </div>
  );
}

interface PlayerSquareViewProps {
  square: PlayerSquare;
  coord: Coord;
  isSelected: boolean;
  onTileSelect: (coord: Coord) => void;
  isVisible: boolean;
  children: ReactNode;
}

function PlayerSquareView({
  square,
  isVisible,
  children,
}: PlayerSquareViewProps) {
  const className = clsx(
    'cell',
    square && square.type.toString().toLowerCase(),
    !isVisible && 'fog-of-war',
  );

  if (!square) {
    throw new Error('Square is null');
  }

  return <div className={className}>{isVisible && children}</div>;
}

export { PlayerSquareLayout, PlayerSquareView };
export type { PlayerSquareViewProps };
