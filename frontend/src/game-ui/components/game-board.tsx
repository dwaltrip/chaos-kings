import clsx from 'clsx';
import type { BoardState } from '@core/types';
import { Tile } from '@/game-ui/components/tile';

interface GameBoardProps {
  boardState: BoardState;
  disabled?: boolean;
}

function GameBoard({ boardState, disabled = false }: GameBoardProps) {
  const grid = boardState.grid;
  const gridRows = grid.length;
  const gridCols = grid[0]?.length || 0;

  return (
    <div
      className={clsx('grid', disabled && 'game-ui-disabled')}
      style={{ '--rows': gridRows, '--cols': gridCols } as React.CSSProperties}
    >
      {grid.flat().map((_, i) => {
        const row = Math.floor(i / gridCols);
        const col = i % gridCols;
        const coord = { x: col, y: row };
        const coordKey = `${coord.x},${coord.y}`;

        return <Tile coord={coord} key={coordKey} />;
      })}
    </div>
  );
}

export { GameBoard };
