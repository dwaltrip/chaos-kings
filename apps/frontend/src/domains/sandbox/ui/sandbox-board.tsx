import type { BoardState } from '@core/types';
import { serializeCoord } from '@core/utils/coordinate-utils';

import { useGridLayout } from '@/domains/gameplay/hooks/use-grid-layout';
import { SandboxTile } from '@/domains/sandbox/ui/sandbox-tile';

import '@/domains/gameplay/ui/game-board.css';

interface SandboxBoardProps {
  boardState: BoardState;
}

function SandboxBoard({ boardState }: SandboxBoardProps) {
  const rows = boardState.grid.length;
  const cols = boardState.grid[0]?.length || 0;
  const { containerRef, gridStyle } = useGridLayout(rows, cols);

  return (
    <div ref={containerRef} className="game-grid-container">
      <div className="game-grid" style={gridStyle}>
        {boardState.grid.flatMap((row) =>
          row.map(({ coord }) => (
            <SandboxTile coord={coord} key={serializeCoord(coord)} />
          )),
        )}
      </div>
    </div>
  );
}

export { SandboxBoard };
