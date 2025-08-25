import type { BoardState } from '@core/types';
import { useGridLayout } from '@/game-ui/hooks/use-grid-layout';
import { GameTile } from '@/game-ui/components/game-tile';

import '@/game-ui/game-board.css';

interface GameBoardProps {
  boardState: BoardState;
  disabled?: boolean;
}

function GameBoard({ boardState }: GameBoardProps) {
  const rows = boardState.grid.length;
  const cols = boardState.grid[0]?.length || 0;
  const { containerRef, gridStyle } = useGridLayout(rows, cols);

  return (
    <div ref={containerRef} className="game-grid-container">
      <div className="game-grid" style={gridStyle}>
        {boardState.grid.flatMap((row, y) =>
          row.map((_, x) => (
            <GameTile key={`${x}-${y}`} coord={{ x, y }} row={y} col={x} />
          )),
        )}
      </div>
    </div>
  );
}

export { GameBoard };
