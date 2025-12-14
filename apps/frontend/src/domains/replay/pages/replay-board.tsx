import type { BoardState } from '@core/types';
import { serializeCoord } from '@core/utils/coordinate-utils';

import { useGridLayout } from '@/domains/gameplay/hooks/use-grid-layout';
import { ReplayTile } from '@/domains/replay/pages/replay-tile';

import '@/domains/gameplay/ui/game-board.css';

interface ReplayBoardProps {
  boardState: BoardState;
}

function ReplayBoard({ boardState }: ReplayBoardProps) {
  const rows = boardState.grid.length;
  const cols = boardState.grid[0]?.length || 0;
  const { containerRef, gridStyle } = useGridLayout(rows, cols);

  return (
    <div ref={containerRef} className="game-grid-container">
      <div className="game-grid" style={gridStyle}>
        {boardState.grid.flatMap((row) =>
          row.map((square) => (
            <ReplayTile
              coord={square.coord}
              square={square}
              key={serializeCoord(square.coord)}
            />
          )),
        )}
      </div>
    </div>
  );
}

export { ReplayBoard };
