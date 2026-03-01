import clsx from 'clsx';

import type { BoardState, Coord, Direction, Movement } from '@core/types';
import { serializeCoord, areCoordsEqual } from '@core/utils/coordinate-utils';
import { Board } from '@core/board';
import { isMountainSquare } from '@core/square';

import { useGridLayout } from '@/domains/gameplay/hooks/use-grid-layout';
import { LabTile } from '@/domains/game-ui-lab/ui/lab-tile';

import '@/domains/gameplay/ui/game-board.css';

interface LabBoardProps {
  boardState: BoardState;
  playerIndex: number;
  queuedMoves: Movement[];
  selectedTile: Coord | null;
  variantClassName?: string;
}

function buildQueuedDirectionsMap(queuedMoves: Movement[]): Map<string, Set<Direction>> {
  const map = new Map<string, Set<Direction>>();
  for (const move of queuedMoves) {
    const key = serializeCoord(move.sourceCoord);
    if (!map.has(key)) {
      map.set(key, new Set());
    }
    map.get(key)!.add(move.direction);
  }
  return map;
}

function getNeighborVisibility(
  coord: Coord,
  visibleSquares: Set<string>,
): { top: boolean; left: boolean } {
  return {
    top: visibleSquares.has(serializeCoord({ x: coord.x, y: coord.y - 1 })),
    left: visibleSquares.has(serializeCoord({ x: coord.x - 1, y: coord.y })),
  };
}

function isAdjacentTo(a: Coord, b: Coord | null): boolean {
  if (!b) return false;
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

function LabBoard({
  boardState,
  playerIndex,
  queuedMoves,
  selectedTile,
  variantClassName,
}: LabBoardProps) {
  const rows = boardState.grid.length;
  const cols = boardState.grid[0]?.length || 0;
  const { containerRef, gridStyle } = useGridLayout(rows, cols);

  const visibleSquares = Board.getVisibleSquares(boardState, playerIndex);
  const queuedDirectionsMap = buildQueuedDirectionsMap(queuedMoves);

  return (
    <div ref={containerRef} className={clsx('game-grid-container', variantClassName)}>
      <div className="game-grid" style={gridStyle}>
        {boardState.grid.flatMap((row) =>
          row.map((square) => {
            const key = serializeCoord(square.coord);
            const isSelected = areCoordsEqual(square.coord, selectedTile);
            const adjacent = isAdjacentTo(square.coord, selectedTile);
            const isValidMove = adjacent && !isMountainSquare(square);
            return (
              <LabTile
                key={key}
                coord={square.coord}
                square={square}
                isVisible={visibleSquares.has(key)}
                neighborVisibility={getNeighborVisibility(square.coord, visibleSquares)}
                queuedDirections={queuedDirectionsMap.get(key)}
                isSelected={isSelected}
                isValidMove={isValidMove}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}

export { LabBoard };
