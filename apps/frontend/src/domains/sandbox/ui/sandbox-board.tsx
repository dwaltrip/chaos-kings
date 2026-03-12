import type { BoardState } from '@core/types';
import { serializeCoord } from '@core/utils/coordinate-utils';

import { boardStore, userSelectTile } from '@/domains/games/board-store';
import { BoardTile } from '@/domains/games/board/ui/board-tile';
import { useGridLayout } from '@/domains/gameplay/hooks/use-grid-layout';

import '@/domains/gameplay/ui/game-board.css';

interface SandboxBoardProps {
  boardState: BoardState;
}

function SandboxBoard({ boardState }: SandboxBoardProps) {
  const rows = boardState.grid.length;
  const cols = boardState.grid[0]?.length || 0;
  const { containerRef, gridStyle } = useGridLayout(rows, cols);

  const handleGridClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div ref={containerRef} className="game-grid-container">
      <div className="game-grid" style={gridStyle} onClick={handleGridClick}>
        {boardState.grid.flatMap((row) =>
          row.map(({ coord }) => (
            <BoardTile
              store={boardStore}
              coord={coord}
              onClick={() => userSelectTile(coord)}
              key={serializeCoord(coord)}
            />
          )),
        )}
      </div>
    </div>
  );
}

export { SandboxBoard };
