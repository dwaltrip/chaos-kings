import type { GameWithPlayers } from '@common/types/games';
import { type BoardState, type Coord } from '@core/types';
import { isEnded } from '@core/game';

import { isSquareVisible } from '@/game-ui/utils/visibility-utils';
import { Tile } from '@/game-ui/components/tile';

interface GameBoardProps {
  game: GameWithPlayers;
  boardState: BoardState;
  selectedTile: Coord | null;
  onTileSelect: (coord: Coord) => void;
  currentPlayerIndex: number | null;
  visibleSquares: Set<Coord>;
}

function GameBoard({
  game,
  boardState,
  selectedTile,
  onTileSelect,
  currentPlayerIndex,
  visibleSquares,
}: GameBoardProps) {
  const grid = boardState.grid;
  const gridRows = grid.length;
  const gridCols = grid[0]?.length || 0;

  return (
    <div
      className="grid"
      style={{ '--rows': gridRows, '--cols': gridCols } as React.CSSProperties}
    >
      {grid.flat().map((square, i) => {
        const row = Math.floor(i / gridCols);
        const col = i % gridCols;
        const coord = { x: col, y: row };
        const isSelected = selectedTile
          ? selectedTile.x === coord.x && selectedTile.y === coord.y
          : false;
        const isVisible =
          isEnded(game) ||
          isSquareVisible(coord, visibleSquares, currentPlayerIndex);
        return (
          <Tile
            square={square}
            coord={coord}
            isSelected={isSelected}
            isVisible={isVisible}
            onTileSelect={onTileSelect}
            key={`${coord.x},${coord.y}`}
          />
        );
      })}
    </div>
  );
}

export { GameBoard };
